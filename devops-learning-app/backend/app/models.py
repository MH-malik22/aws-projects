import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    type_annotation_map = {dict: JSONB, list: JSONB}


def pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = pk()
    email: Mapped[str] = mapped_column(Text, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    display_name: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(Text, default="learner")
    xp: Mapped[int] = mapped_column(Integer, default=0)
    theme_pref: Mapped[str] = mapped_column(Text, default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Module(Base):
    __tablename__ = "modules"
    id: Mapped[uuid.UUID] = pk()
    slug: Mapped[str] = mapped_column(Text, unique=True)
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer)
    est_hours: Mapped[float] = mapped_column(Numeric(4, 1), default=4.0)
    published: Mapped[bool] = mapped_column(Boolean, default=True)

    lessons: Mapped[list["Lesson"]] = relationship(back_populates="module", order_by="Lesson.sort_order")
    labs: Mapped[list["Lab"]] = relationship(back_populates="module", order_by="Lab.sort_order")
    quizzes: Mapped[list["Quiz"]] = relationship(back_populates="module")


class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (UniqueConstraint("module_id", "slug"),)
    id: Mapped[uuid.UUID] = pk()
    module_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("modules.id", ondelete="CASCADE"))
    slug: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    body_md: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer)

    module: Mapped[Module] = relationship(back_populates="lessons")


class Quiz(Base):
    __tablename__ = "quizzes"
    id: Mapped[uuid.UUID] = pk()
    module_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("modules.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(Text)
    pass_threshold: Mapped[int] = mapped_column(Integer, default=70)
    version: Mapped[int] = mapped_column(Integer, default=1)

    module: Mapped[Module] = relationship(back_populates="quizzes")
    questions: Mapped[list["Question"]] = relationship(back_populates="quiz", order_by="Question.sort_order")


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (UniqueConstraint("quiz_id", "external_id"),)
    id: Mapped[uuid.UUID] = pk()
    quiz_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"))
    external_id: Mapped[str] = mapped_column(Text)
    qtype: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(Text)
    prompt: Mapped[str] = mapped_column(Text)
    options: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    correct_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    correct_bool: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    accepted_answers: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    case_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    explanation: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer)

    quiz: Mapped[Quiz] = relationship(back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id: Mapped[uuid.UUID] = pk()
    quiz_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    quiz_version: Mapped[int] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    score_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="CASCADE"), primary_key=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True
    )
    answer_payload: Mapped[dict] = mapped_column(JSONB)
    is_correct: Mapped[bool] = mapped_column(Boolean)


class Lab(Base):
    __tablename__ = "labs"
    __table_args__ = (UniqueConstraint("module_id", "slug"),)
    id: Mapped[uuid.UUID] = pk()
    module_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("modules.id", ondelete="CASCADE"))
    slug: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    intro_md: Mapped[str] = mapped_column(Text)
    mode: Mapped[str] = mapped_column(Text, default="simulated")
    image: Mapped[str | None] = mapped_column(Text, nullable=True)
    verify_script: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer)

    module: Mapped[Module] = relationship(back_populates="labs")
    steps: Mapped[list["LabStep"]] = relationship(back_populates="lab", order_by="LabStep.step_no")


class LabStep(Base):
    __tablename__ = "lab_steps"
    __table_args__ = (UniqueConstraint("lab_id", "step_no"),)
    id: Mapped[uuid.UUID] = pk()
    lab_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("labs.id", ondelete="CASCADE"))
    step_no: Mapped[int] = mapped_column(Integer)
    instruction_md: Mapped[str] = mapped_column(Text)
    expected_commands: Mapped[list] = mapped_column(JSONB, default=list)
    mock_output: Mapped[str] = mapped_column(Text, default="")
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)

    lab: Mapped[Lab] = relationship(back_populates="steps")


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    lesson_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LabProgress(Base):
    __tablename__ = "lab_progress"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    lab_step_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lab_steps.id", ondelete="CASCADE"), primary_key=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserQuizScore(Base):
    __tablename__ = "user_quiz_scores"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    quiz_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"), primary_key=True)
    best_pct: Mapped[float] = mapped_column(Numeric(5, 2))
    passed: Mapped[bool] = mapped_column(Boolean)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Badge(Base):
    __tablename__ = "badges"
    id: Mapped[uuid.UUID] = pk()
    slug: Mapped[str] = mapped_column(Text, unique=True)
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(Text)
    rule: Mapped[dict] = mapped_column(JSONB)


class UserBadge(Base):
    __tablename__ = "user_badges"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    badge_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("badges.id", ondelete="CASCADE"), primary_key=True)
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ActivityLog(Base):
    __tablename__ = "activity_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(Text)
    ref_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    xp_delta: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
