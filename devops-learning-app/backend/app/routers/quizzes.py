import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import get_current_user
from ..database import get_db
from ..gamify import XP_QUIZ_EXCELLENT_BONUS, XP_QUIZ_PASS, award_xp, evaluate_badges
from ..models import (
    AttemptAnswer,
    Module,
    Question,
    Quiz,
    QuizAttempt,
    User,
    UserQuizScore,
)
from ..schemas import (
    AnswerIn,
    AttemptOut,
    QuestionPublic,
    QuestionResult,
    QuizOut,
    SubmitIn,
    SubmitOut,
)

router = APIRouter(tags=["quizzes"])


def _grade(question: Question, answer: AnswerIn) -> tuple[bool, dict]:
    """Returns (is_correct, correct_answer payload)."""
    if question.qtype in ("mcq", "scenario"):
        return answer.index == question.correct_index, {"index": question.correct_index}
    if question.qtype == "true_false":
        return answer.answer_bool == question.correct_bool, {"bool": question.correct_bool}
    # command: normalize whitespace; case-insensitive unless flagged
    given = " ".join((answer.text or "").split())
    accepted = [" ".join(a.split()) for a in (question.accepted_answers or [])]
    if not question.case_sensitive:
        given = given.lower()
        accepted = [a.lower() for a in accepted]
    return given in accepted, {"text": (question.accepted_answers or [""])[0]}


@router.get("/modules/{slug}/quiz", response_model=QuizOut)
async def get_module_quiz(
    slug: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    quiz = await db.scalar(
        select(Quiz)
        .join(Module, Module.id == Quiz.module_id)
        .where(Module.slug == slug)
        .options(selectinload(Quiz.questions))
    )
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found")
    return QuizOut(
        quiz_id=quiz.id,
        title=quiz.title,
        pass_threshold=quiz.pass_threshold,
        questions=[
            QuestionPublic(
                id=q.id,
                external_id=q.external_id,
                qtype=q.qtype,
                difficulty=q.difficulty,
                prompt=q.prompt,
                options=q.options if q.qtype in ("mcq", "scenario") else None,
            )
            for q in quiz.questions
        ],
    )


@router.post("/quizzes/{quiz_id}/attempts", response_model=AttemptOut, status_code=201)
async def start_attempt(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    quiz = await db.scalar(select(Quiz).where(Quiz.id == quiz_id))
    if quiz is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found")
    attempt = QuizAttempt(quiz_id=quiz.id, user_id=user.id, quiz_version=quiz.version)
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)
    return AttemptOut(attempt_id=attempt.id, quiz_id=quiz.id, started_at=attempt.started_at)


@router.post("/attempts/{attempt_id}/submit", response_model=SubmitOut)
async def submit_attempt(
    attempt_id: uuid.UUID,
    body: SubmitIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = await db.scalar(
        select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user.id)
    )
    if attempt is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found")
    if attempt.submitted_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Attempt already submitted")

    quiz = await db.scalar(
        select(Quiz).where(Quiz.id == attempt.quiz_id).options(selectinload(Quiz.questions))
    )
    questions = {q.id: q for q in quiz.questions}
    answers = {a.question_id: a for a in body.answers}

    results: list[QuestionResult] = []
    correct_count = 0
    for qid, question in questions.items():
        answer = answers.get(qid, AnswerIn(question_id=qid))
        is_correct, correct_answer = _grade(question, answer)
        correct_count += int(is_correct)
        db.add(
            AttemptAnswer(
                attempt_id=attempt.id,
                question_id=qid,
                answer_payload=answer.model_dump(
                    exclude={"question_id"}, exclude_none=True, by_alias=True
                ),
                is_correct=is_correct,
            )
        )
        results.append(
            QuestionResult(
                question_id=qid,
                correct=is_correct,
                correct_answer=correct_answer,
                explanation=question.explanation,
            )
        )

    score = round(100.0 * correct_count / max(len(questions), 1), 2)
    passed = score >= quiz.pass_threshold
    attempt.submitted_at = datetime.now(timezone.utc)
    attempt.score_pct = score
    attempt.passed = passed

    # best-score cache
    best = await db.scalar(
        select(UserQuizScore).where(
            UserQuizScore.user_id == user.id, UserQuizScore.quiz_id == quiz.id
        )
    )
    first_pass = passed and (best is None or not best.passed)
    if best is None:
        db.add(UserQuizScore(user_id=user.id, quiz_id=quiz.id, best_pct=score, passed=passed))
    else:
        best.best_pct = max(float(best.best_pct), score)
        best.passed = best.passed or passed

    xp = 0
    if first_pass:
        xp = XP_QUIZ_PASS + (XP_QUIZ_EXCELLENT_BONUS if score >= 90 else 0)
        await award_xp(db, user, "quiz_pass", xp, quiz.id)

    new_badges = await evaluate_badges(db, user)
    await db.commit()

    return SubmitOut(
        score_pct=score,
        passed=passed,
        xp_awarded=xp,
        results=results,
        new_badges=[{"slug": b.slug, "title": b.title} for b in new_badges],
    )


@router.get("/attempts/{attempt_id}", response_model=SubmitOut)
async def review_attempt(
    attempt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = await db.scalar(
        select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user.id)
    )
    if attempt is None or attempt.submitted_at is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Graded attempt not found")

    rows = (
        await db.scalars(select(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt.id))
    ).all()
    questions = {
        q.id: q
        for q in (
            await db.scalars(select(Question).where(Question.quiz_id == attempt.quiz_id))
        ).all()
    }
    results = []
    for row in rows:
        q = questions.get(row.question_id)
        if q is None:
            continue
        if q.qtype in ("mcq", "scenario"):
            correct_answer = {"index": q.correct_index}
        elif q.qtype == "true_false":
            correct_answer = {"bool": q.correct_bool}
        else:
            correct_answer = {"text": (q.accepted_answers or [""])[0]}
        results.append(
            QuestionResult(
                question_id=row.question_id,
                correct=row.is_correct,
                correct_answer=correct_answer,
                explanation=q.explanation,
            )
        )
    return SubmitOut(
        score_pct=float(attempt.score_pct),
        passed=attempt.passed,
        xp_awarded=0,
        results=results,
    )
