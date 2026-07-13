from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import get_current_user, get_current_user_optional
from ..database import get_db
from ..gamify import XP_LESSON, award_xp, evaluate_badges
from ..models import Lab, LabProgress, LabStep, Lesson, LessonProgress, Module, User, UserQuizScore
from ..schemas import (
    LabSummary,
    LessonOut,
    LessonSummary,
    ModuleDetail,
    ModuleSummary,
    QuizSummary,
)

router = APIRouter(prefix="/modules", tags=["modules"])


async def _get_module(db: AsyncSession, slug: str) -> Module:
    module = await db.scalar(
        select(Module)
        .where(Module.slug == slug, Module.published.is_(True))
        .options(
            selectinload(Module.lessons),
            selectinload(Module.labs).selectinload(Lab.steps),
            selectinload(Module.quizzes),
        )
    )
    if module is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
    return module


@router.get("", response_model=list[ModuleSummary])
async def list_modules(
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    modules = (
        await db.scalars(
            select(Module)
            .where(Module.published.is_(True))
            .order_by(Module.sort_order)
            .options(selectinload(Module.lessons), selectinload(Module.labs).selectinload(Lab.steps))
        )
    ).all()

    done_lessons: set = set()
    done_steps: set = set()
    passed_quizzes: set = set()
    if user:
        done_lessons = set(
            (await db.scalars(select(LessonProgress.lesson_id).where(LessonProgress.user_id == user.id))).all()
        )
        done_steps = set(
            (await db.scalars(select(LabProgress.lab_step_id).where(LabProgress.user_id == user.id))).all()
        )
        passed_quizzes = set(
            (
                await db.scalars(
                    select(UserQuizScore.quiz_id).where(
                        UserQuizScore.user_id == user.id, UserQuizScore.passed.is_(True)
                    )
                )
            ).all()
        )

    out = []
    for m in modules:
        total_steps = sum(len(lab.steps) for lab in m.labs)
        summary = ModuleSummary(
            slug=m.slug,
            title=m.title,
            description=m.description,
            icon=m.icon,
            difficulty=m.difficulty,
            est_hours=float(m.est_hours),
            lessons=len(m.lessons),
            labs=len(m.labs),
        )
        if user:
            lessons_done = sum(1 for l in m.lessons if l.id in done_lessons)
            steps_done = sum(1 for lab in m.labs for s in lab.steps if s.id in done_steps)
            quiz_passed = any(q.id in passed_quizzes for q in m.quizzes)
            denom = len(m.lessons) + total_steps + 1
            summary.progress_pct = round(
                100.0 * (lessons_done + steps_done + (1 if quiz_passed else 0)) / denom, 1
            )
        out.append(summary)
    return out


@router.get("/{slug}", response_model=ModuleDetail)
async def module_detail(
    slug: str,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    m = await _get_module(db, slug)

    done_lessons: set = set()
    done_steps: set = set()
    best: dict = {}
    if user:
        done_lessons = set(
            (await db.scalars(select(LessonProgress.lesson_id).where(LessonProgress.user_id == user.id))).all()
        )
        done_steps = set(
            (await db.scalars(select(LabProgress.lab_step_id).where(LabProgress.user_id == user.id))).all()
        )
        for row in await db.scalars(select(UserQuizScore).where(UserQuizScore.user_id == user.id)):
            best[row.quiz_id] = row

    quiz = m.quizzes[0] if m.quizzes else None
    quiz_summary = None
    if quiz:
        score = best.get(quiz.id)
        # question count loaded lazily is not available on async; count via len after selectinload not set,
        # so query count explicitly
        from ..models import Question
        from sqlalchemy import func

        q_count = await db.scalar(select(func.count()).select_from(Question).where(Question.quiz_id == quiz.id))
        quiz_summary = QuizSummary(
            quiz_id=quiz.id,
            title=quiz.title,
            questions=q_count or 0,
            pass_threshold=quiz.pass_threshold,
            best_pct=float(score.best_pct) if score else None,
            passed=score.passed if score else None,
        )

    total_steps = sum(len(lab.steps) for lab in m.labs)
    lessons_done = sum(1 for l in m.lessons if l.id in done_lessons)
    steps_done = sum(1 for lab in m.labs for s in lab.steps if s.id in done_steps)
    quiz_passed = bool(quiz and best.get(quiz.id) and best[quiz.id].passed)
    denom = len(m.lessons) + total_steps + 1

    return ModuleDetail(
        slug=m.slug,
        title=m.title,
        description=m.description,
        icon=m.icon,
        difficulty=m.difficulty,
        est_hours=float(m.est_hours),
        lessons=len(m.lessons),
        labs=len(m.labs),
        progress_pct=round(100.0 * (lessons_done + steps_done + (1 if quiz_passed else 0)) / denom, 1)
        if user
        else None,
        lesson_list=[
            LessonSummary(slug=l.slug, title=l.title, completed=l.id in done_lessons) for l in m.lessons
        ],
        lab_list=[
            LabSummary(
                id=lab.id,
                slug=lab.slug,
                title=lab.title,
                mode=lab.mode,
                steps=len(lab.steps),
                steps_done=sum(1 for s in lab.steps if s.id in done_steps),
            )
            for lab in m.labs
        ],
        quiz=quiz_summary,
    )


@router.get("/{slug}/lessons/{lesson_slug}", response_model=LessonOut)
async def get_lesson(
    slug: str,
    lesson_slug: str,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    m = await _get_module(db, slug)
    lesson = next((l for l in m.lessons if l.slug == lesson_slug), None)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")
    completed = False
    if user:
        completed = (
            await db.scalar(
                select(LessonProgress).where(
                    LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson.id
                )
            )
        ) is not None
    return LessonOut(slug=lesson.slug, title=lesson.title, body_md=lesson.body_md, completed=completed)


@router.post("/{slug}/lessons/{lesson_slug}/complete")
async def complete_lesson(
    slug: str,
    lesson_slug: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    m = await _get_module(db, slug)
    lesson = next((l for l in m.lessons if l.slug == lesson_slug), None)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found")

    existing = await db.scalar(
        select(LessonProgress).where(
            LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson.id
        )
    )
    if existing:
        return {"already_completed": True, "xp_awarded": 0}

    db.add(LessonProgress(user_id=user.id, lesson_id=lesson.id))
    await award_xp(db, user, "lesson_done", XP_LESSON, lesson.id)
    new_badges = await evaluate_badges(db, user)
    await db.commit()
    return {
        "already_completed": False,
        "xp_awarded": XP_LESSON,
        "new_badges": [{"slug": b.slug, "title": b.title} for b in new_badges],
    }
