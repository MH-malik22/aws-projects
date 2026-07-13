"""XP awards and badge rule evaluation."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    ActivityLog,
    Badge,
    LabProgress,
    Module,
    Quiz,
    User,
    UserBadge,
    UserQuizScore,
)

XP_LESSON = 10
XP_LAB_STEP = 5
XP_QUIZ_PASS = 50
XP_QUIZ_EXCELLENT_BONUS = 10  # score >= 90


async def award_xp(db: AsyncSession, user: User, kind: str, xp: int, ref_id: uuid.UUID | None = None) -> None:
    user.xp += xp
    db.add(ActivityLog(user_id=user.id, kind=kind, ref_id=ref_id, xp_delta=xp))


async def evaluate_badges(db: AsyncSession, user: User) -> list[Badge]:
    """Run all badge rules for a user; award and return any newly earned badges."""
    earned_ids = set(
        (await db.scalars(select(UserBadge.badge_id).where(UserBadge.user_id == user.id))).all()
    )
    badges = (await db.scalars(select(Badge))).all()
    new: list[Badge] = []

    for badge in badges:
        if badge.id in earned_ids:
            continue
        if await _rule_met(db, user, badge.rule):
            db.add(UserBadge(user_id=user.id, badge_id=badge.id))
            db.add(ActivityLog(user_id=user.id, kind="badge", ref_id=badge.id, xp_delta=0))
            new.append(badge)
    return new


async def _rule_met(db: AsyncSession, user: User, rule: dict) -> bool:
    rtype = rule.get("type")

    if rtype == "first_quiz_pass":
        return await db.scalar(
            select(func.count()).select_from(UserQuizScore).where(
                UserQuizScore.user_id == user.id, UserQuizScore.passed.is_(True)
            )
        ) > 0

    if rtype == "module_mastery":
        return await db.scalar(
            select(func.count())
            .select_from(UserQuizScore)
            .join(Quiz, Quiz.id == UserQuizScore.quiz_id)
            .join(Module, Module.id == Quiz.module_id)
            .where(
                UserQuizScore.user_id == user.id,
                UserQuizScore.passed.is_(True),
                Module.slug == rule.get("module_slug"),
            )
        ) > 0

    if rtype == "labs_completed":
        done = await db.scalar(
            select(func.count()).select_from(LabProgress).where(LabProgress.user_id == user.id)
        )
        return done >= rule.get("count", 1)

    if rtype == "xp_reached":
        return user.xp >= rule.get("xp", 0)

    if rtype == "streak_days":
        days = await db.scalar(
            select(func.count(func.distinct(func.date(ActivityLog.created_at)))).where(
                ActivityLog.user_id == user.id
            )
        )
        return days >= rule.get("days", 1)

    return False
