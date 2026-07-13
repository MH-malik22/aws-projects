"""Idempotent content seeder: content/modules/** → database.

Usage:
    python -m app.seed          # uses DATABASE_URL from env/.env

Each module directory must contain:
    meta.json    {slug, title, description, icon, difficulty, sort_order, est_hours}
    module.md    lesson content split on '## ' H2 headings → one lesson per section
    labs.json    [{slug, title, intro_md, mode, steps:[{step_no, instruction_md,
                   expected_commands, mock_output, hint}]}]
    quiz.json    {title, pass_threshold, questions:[...]}
"""

import asyncio
import json
import re
from pathlib import Path

from sqlalchemy import select

from .config import settings
from .database import SessionLocal
from .models import Badge, Lab, LabStep, Lesson, Module, Question, Quiz

BADGES = [
    {"slug": "first-steps", "title": "First Steps", "icon": "🎯",
     "description": "Pass your first quiz", "rule": {"type": "first_quiz_pass"}},
    {"slug": "lab-rat", "title": "Lab Rat", "icon": "🔬",
     "description": "Complete 10 lab steps", "rule": {"type": "labs_completed", "count": 10}},
    {"slug": "streak-7", "title": "On Fire", "icon": "🔥",
     "description": "Learn on 7 different days", "rule": {"type": "streak_days", "days": 7}},
    {"slug": "xp-1000", "title": "Grinder", "icon": "⚡",
     "description": "Reach 1000 XP", "rule": {"type": "xp_reached", "xp": 1000}},
]
# one mastery badge per module, generated below


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def split_lessons(module_md: str) -> list[tuple[str, str]]:
    """Split module.md into (title, body) pairs on H2 headings."""
    parts = re.split(r"^## ", module_md, flags=re.MULTILINE)
    lessons = []
    for part in parts[1:]:  # parts[0] is the intro before the first H2
        title, _, body = part.partition("\n")
        lessons.append((title.strip(), body.strip()))
    return lessons


async def seed() -> None:
    content_dir = Path(__file__).resolve().parent.parent / Path(settings.content_dir) / "modules"
    if not content_dir.exists():
        content_dir = Path(settings.content_dir) / "modules"
    module_dirs = sorted(p for p in content_dir.iterdir() if p.is_dir())

    async with SessionLocal() as db:
        for mdir in module_dirs:
            meta = json.loads((mdir / "meta.json").read_text())
            module = await db.scalar(select(Module).where(Module.slug == meta["slug"]))
            if module is None:
                module = Module(slug=meta["slug"], title="", description="", difficulty="beginner", sort_order=0)
                db.add(module)
            module.title = meta["title"]
            module.description = meta["description"]
            module.icon = meta.get("icon", "")
            module.difficulty = meta["difficulty"]
            module.sort_order = meta["sort_order"]
            module.est_hours = meta.get("est_hours", 4.0)
            await db.flush()

            # lessons from module.md H2 sections
            for i, (title, body) in enumerate(split_lessons((mdir / "module.md").read_text()), 1):
                lslug = slugify(title)
                lesson = await db.scalar(
                    select(Lesson).where(Lesson.module_id == module.id, Lesson.slug == lslug)
                )
                if lesson is None:
                    lesson = Lesson(module_id=module.id, slug=lslug, title="", body_md="", sort_order=0)
                    db.add(lesson)
                lesson.title = title
                lesson.body_md = body
                lesson.sort_order = i

            # labs
            labs_file = mdir / "labs.json"
            if labs_file.exists():
                for j, lab_def in enumerate(json.loads(labs_file.read_text()), 1):
                    lab = await db.scalar(
                        select(Lab).where(Lab.module_id == module.id, Lab.slug == lab_def["slug"])
                    )
                    if lab is None:
                        lab = Lab(module_id=module.id, slug=lab_def["slug"], title="", intro_md="", sort_order=0)
                        db.add(lab)
                    lab.title = lab_def["title"]
                    lab.intro_md = lab_def["intro_md"]
                    lab.mode = lab_def.get("mode", "simulated")
                    lab.image = lab_def.get("image")
                    lab.verify_script = lab_def.get("verify_script")
                    lab.sort_order = j
                    await db.flush()
                    for step_def in lab_def["steps"]:
                        step = await db.scalar(
                            select(LabStep).where(
                                LabStep.lab_id == lab.id, LabStep.step_no == step_def["step_no"]
                            )
                        )
                        if step is None:
                            step = LabStep(lab_id=lab.id, step_no=step_def["step_no"], instruction_md="")
                            db.add(step)
                        step.instruction_md = step_def["instruction_md"]
                        step.expected_commands = step_def.get("expected_commands", [])
                        step.mock_output = step_def.get("mock_output", "")
                        step.hint = step_def.get("hint")

            # quiz
            quiz_def = json.loads((mdir / "quiz.json").read_text())
            quiz = await db.scalar(select(Quiz).where(Quiz.module_id == module.id))
            if quiz is None:
                quiz = Quiz(module_id=module.id, title="")
                db.add(quiz)
            else:
                quiz.version += 1
            quiz.title = quiz_def["title"]
            quiz.pass_threshold = quiz_def.get("pass_threshold", 70)
            await db.flush()
            for k, q in enumerate(quiz_def["questions"], 1):
                question = await db.scalar(
                    select(Question).where(
                        Question.quiz_id == quiz.id, Question.external_id == q["id"]
                    )
                )
                if question is None:
                    question = Question(
                        quiz_id=quiz.id, external_id=q["id"], qtype="mcq",
                        difficulty="beginner", prompt="", explanation="", sort_order=0,
                    )
                    db.add(question)
                question.qtype = q["type"]
                question.difficulty = q.get("difficulty", "beginner")
                question.prompt = q["question"]
                question.options = q.get("options")
                question.correct_index = q.get("answer_index")
                question.correct_bool = q.get("answer_bool")
                question.accepted_answers = q.get("accepted_answers")
                question.case_sensitive = q.get("case_sensitive", False)
                question.explanation = q["explanation"]
                question.sort_order = k

            print(f"seeded module: {meta['slug']}")

        # badges (global + per-module mastery)
        all_badges = BADGES + [
            {"slug": f"{d.name.split('-', 1)[1] if '-' in d.name else d.name}-master",
             "title": f"{json.loads((d / 'meta.json').read_text())['title']} Master",
             "icon": "🏅",
             "description": f"Pass the {json.loads((d / 'meta.json').read_text())['title']} quiz",
             "rule": {"type": "module_mastery",
                      "module_slug": json.loads((d / 'meta.json').read_text())["slug"]}}
            for d in module_dirs
        ]
        for b in all_badges:
            badge = await db.scalar(select(Badge).where(Badge.slug == b["slug"]))
            if badge is None:
                badge = Badge(slug=b["slug"], title="", description="", icon="", rule={})
                db.add(badge)
            badge.title = b["title"]
            badge.description = b["description"]
            badge.icon = b["icon"]
            badge.rule = b["rule"]

        await db.commit()
        print("seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
