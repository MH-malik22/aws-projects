#!/usr/bin/env python3
"""Validate curriculum content structure — run in CI before anything else.

Checks every content/modules/<dir>/:
  - meta.json, module.md, quiz.json exist (labs.json optional but expected)
  - quiz questions are well-formed per type, with explanations
  - external question ids are unique within a module
  - lab steps are sequentially numbered with expected_commands
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "content" / "modules"
REQUIRED_META = {"slug", "title", "description", "difficulty", "sort_order"}
QTYPES = {"mcq", "true_false", "scenario", "command"}

errors: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def check_quiz(mdir: Path) -> None:
    quiz = json.loads((mdir / "quiz.json").read_text())
    if "title" not in quiz or "questions" not in quiz:
        err(f"{mdir.name}: quiz.json missing title/questions")
        return
    if not 10 <= len(quiz["questions"]) <= 20:
        err(f"{mdir.name}: quiz has {len(quiz['questions'])} questions (want 10-20)")
    seen: set[str] = set()
    for q in quiz["questions"]:
        qid = q.get("id", "<missing id>")
        if qid in seen:
            err(f"{mdir.name}: duplicate question id {qid}")
        seen.add(qid)
        qtype = q.get("type")
        if qtype not in QTYPES:
            err(f"{mdir.name}/{qid}: bad type {qtype}")
            continue
        if not q.get("question") or not q.get("explanation"):
            err(f"{mdir.name}/{qid}: missing question or explanation")
        if qtype in ("mcq", "scenario"):
            opts = q.get("options") or []
            idx = q.get("answer_index")
            if len(opts) < 2 or idx is None or not (0 <= idx < len(opts)):
                err(f"{mdir.name}/{qid}: bad options/answer_index")
        elif qtype == "true_false":
            if not isinstance(q.get("answer_bool"), bool):
                err(f"{mdir.name}/{qid}: answer_bool must be true/false")
        elif qtype == "command":
            if not q.get("accepted_answers"):
                err(f"{mdir.name}/{qid}: command question needs accepted_answers")


def check_labs(mdir: Path) -> None:
    labs_file = mdir / "labs.json"
    if not labs_file.exists():
        err(f"{mdir.name}: labs.json missing")
        return
    for lab in json.loads(labs_file.read_text()):
        steps = lab.get("steps", [])
        if not steps:
            err(f"{mdir.name}/{lab.get('slug')}: lab has no steps")
        for i, step in enumerate(steps, 1):
            if step.get("step_no") != i:
                err(f"{mdir.name}/{lab.get('slug')}: step_no gap at position {i}")
            if not step.get("expected_commands"):
                err(f"{mdir.name}/{lab.get('slug')} step {i}: no expected_commands")


def main() -> int:
    if not ROOT.exists():
        print(f"content root not found: {ROOT}", file=sys.stderr)
        return 1
    module_dirs = sorted(p for p in ROOT.iterdir() if p.is_dir())
    if len(module_dirs) < 11:
        err(f"expected >= 11 modules, found {len(module_dirs)}")
    for mdir in module_dirs:
        for required in ("meta.json", "module.md", "quiz.json"):
            if not (mdir / required).exists():
                err(f"{mdir.name}: missing {required}")
        if (mdir / "meta.json").exists():
            meta = json.loads((mdir / "meta.json").read_text())
            missing = REQUIRED_META - meta.keys()
            if missing:
                err(f"{mdir.name}: meta.json missing {sorted(missing)}")
        if (mdir / "quiz.json").exists():
            check_quiz(mdir)
        check_labs(mdir)

    if errors:
        print("CONTENT VALIDATION FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"OK: {len(module_dirs)} modules validated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
