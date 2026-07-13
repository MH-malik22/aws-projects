import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import get_current_user
from ..database import get_db
from ..gamify import XP_LAB_STEP, award_xp, evaluate_badges
from ..models import Lab, LabProgress, LabStep, Module, User
from ..schemas import LabOut, LabStepOut, VerifyIn, VerifyOut

router = APIRouter(tags=["labs"])


def _command_matches(command: str, expected: list[str]) -> bool:
    """expected entries are literals, or regexes wrapped as /pattern/."""
    given = " ".join(command.split())
    for exp in expected:
        if exp.startswith("/") and exp.endswith("/") and len(exp) > 2:
            if re.fullmatch(exp[1:-1], given):
                return True
        elif " ".join(exp.split()) == given:
            return True
    return False


@router.get("/modules/{slug}/labs", response_model=list[LabOut])
async def module_labs(
    slug: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    labs = (
        await db.scalars(
            select(Lab)
            .join(Module, Module.id == Lab.module_id)
            .where(Module.slug == slug)
            .order_by(Lab.sort_order)
            .options(selectinload(Lab.steps))
        )
    ).all()
    done = set(
        (await db.scalars(select(LabProgress.lab_step_id).where(LabProgress.user_id == user.id))).all()
    )
    return [_lab_out(lab, done) for lab in labs]


def _lab_out(lab: Lab, done: set) -> LabOut:
    return LabOut(
        id=lab.id,
        slug=lab.slug,
        title=lab.title,
        intro_md=lab.intro_md,
        mode=lab.mode,
        steps=[
            LabStepOut(
                step_no=s.step_no,
                instruction_md=s.instruction_md,
                hint=s.hint,
                completed=s.id in done,
            )
            for s in lab.steps
        ],
    )


@router.get("/labs/{lab_id}", response_model=LabOut)
async def get_lab(
    lab_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lab = await db.scalar(select(Lab).where(Lab.id == lab_id).options(selectinload(Lab.steps)))
    if lab is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lab not found")
    done = set(
        (await db.scalars(select(LabProgress.lab_step_id).where(LabProgress.user_id == user.id))).all()
    )
    return _lab_out(lab, done)


@router.post("/labs/{lab_id}/steps/{step_no}/verify", response_model=VerifyOut)
async def verify_step(
    lab_id: uuid.UUID,
    step_no: int,
    body: VerifyIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lab = await db.scalar(select(Lab).where(Lab.id == lab_id).options(selectinload(Lab.steps)))
    if lab is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lab not found")
    step = next((s for s in lab.steps if s.step_no == step_no), None)
    if step is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Step not found")

    done = set(
        (await db.scalars(select(LabProgress.lab_step_id).where(LabProgress.user_id == user.id))).all()
    )
    # enforce step order: all earlier steps must be complete
    for s in lab.steps:
        if s.step_no < step_no and s.id not in done:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Complete step {s.step_no} first")

    if not _command_matches(body.command, step.expected_commands or []):
        return VerifyOut(correct=False, hint=step.hint)

    xp = 0
    if step.id not in done:
        db.add(LabProgress(user_id=user.id, lab_step_id=step.id))
        await award_xp(db, user, "lab_step", XP_LAB_STEP, step.id)
        await evaluate_badges(db, user)
        await db.commit()
        xp = XP_LAB_STEP

    next_step = step_no + 1 if any(s.step_no == step_no + 1 for s in lab.steps) else None
    return VerifyOut(correct=True, mock_output=step.mock_output, next_step=next_step, xp_awarded=xp)
