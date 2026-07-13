from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import get_current_user
from ..database import get_db
from ..models import (
    ActivityLog,
    Badge,
    Lab,
    LabProgress,
    LessonProgress,
    Module,
    User,
    UserBadge,
    UserQuizScore,
)
from ..schemas import ActivityOut, BadgeOut, ModuleProgressOut

router = APIRouter(tags=["progress"])


@router.get("/progress", response_model=list[ModuleProgressOut])
async def my_progress(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    modules = (
        await db.scalars(
            select(Module)
            .where(Module.published.is_(True))
            .order_by(Module.sort_order)
            .options(
                selectinload(Module.lessons),
                selectinload(Module.labs).selectinload(Lab.steps),
                selectinload(Module.quizzes),
            )
        )
    ).all()
    done_lessons = set(
        (await db.scalars(select(LessonProgress.lesson_id).where(LessonProgress.user_id == user.id))).all()
    )
    done_steps = set(
        (await db.scalars(select(LabProgress.lab_step_id).where(LabProgress.user_id == user.id))).all()
    )
    passed = set(
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
        lessons_done = sum(1 for l in m.lessons if l.id in done_lessons)
        steps_total = sum(len(lab.steps) for lab in m.labs)
        steps_done = sum(1 for lab in m.labs for s in lab.steps if s.id in done_steps)
        quiz_passed = any(q.id in passed for q in m.quizzes)
        denom = len(m.lessons) + steps_total + 1
        out.append(
            ModuleProgressOut(
                slug=m.slug,
                title=m.title,
                icon=m.icon,
                pct=round(100.0 * (lessons_done + steps_done + (1 if quiz_passed else 0)) / denom, 1),
                lessons_done=lessons_done,
                lessons_total=len(m.lessons),
                lab_steps_done=steps_done,
                lab_steps_total=steps_total,
                quiz_passed=quiz_passed,
            )
        )
    return out


@router.get("/progress/activity", response_model=list[ActivityOut])
async def my_activity(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        await db.scalars(
            select(ActivityLog)
            .where(ActivityLog.user_id == user.id)
            .order_by(ActivityLog.created_at.desc())
            .limit(min(limit, 100))
        )
    ).all()
    return [ActivityOut(kind=r.kind, xp_delta=r.xp_delta, created_at=r.created_at) for r in rows]


@router.get("/badges", response_model=list[BadgeOut])
async def my_badges(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    badges = (await db.scalars(select(Badge))).all()
    earned = {
        ub.badge_id: ub.awarded_at
        for ub in (await db.scalars(select(UserBadge).where(UserBadge.user_id == user.id))).all()
    }
    return [
        BadgeOut(
            slug=b.slug,
            title=b.title,
            description=b.description,
            icon=b.icon,
            earned=b.id in earned,
            awarded_at=earned.get(b.id),
        )
        for b in badges
    ]
