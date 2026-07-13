import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

# ── Auth ──────────────────────────────────────────────────────────────


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=60)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshIn(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    role: str
    xp: int
    theme_pref: str

    model_config = {"from_attributes": True}


class UserPatch(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=60)
    theme_pref: str | None = Field(default=None, pattern="^(light|dark|system)$")


# ── Curriculum ────────────────────────────────────────────────────────


class ModuleSummary(BaseModel):
    slug: str
    title: str
    description: str
    icon: str
    difficulty: str
    est_hours: float
    lessons: int
    labs: int
    progress_pct: float | None = None


class LessonSummary(BaseModel):
    slug: str
    title: str
    completed: bool = False


class LabSummary(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    mode: str
    steps: int
    steps_done: int = 0


class QuizSummary(BaseModel):
    quiz_id: uuid.UUID
    title: str
    questions: int
    pass_threshold: int
    best_pct: float | None = None
    passed: bool | None = None


class ModuleDetail(ModuleSummary):
    lesson_list: list[LessonSummary]
    lab_list: list[LabSummary]
    quiz: QuizSummary | None


class LessonOut(BaseModel):
    slug: str
    title: str
    body_md: str
    completed: bool = False


# ── Quiz engine ───────────────────────────────────────────────────────


class QuestionPublic(BaseModel):
    """Question as served BEFORE submission — no answers, no explanations."""

    id: uuid.UUID
    external_id: str
    qtype: str
    difficulty: str
    prompt: str
    options: list[str] | None = None


class QuizOut(BaseModel):
    quiz_id: uuid.UUID
    title: str
    pass_threshold: int
    questions: list[QuestionPublic]


class AttemptOut(BaseModel):
    attempt_id: uuid.UUID
    quiz_id: uuid.UUID
    started_at: datetime


class AnswerIn(BaseModel):
    """Wire format keeps the key `bool`; internally the field is answer_bool
    because `bool` as a field name shadows the builtin in the class body."""

    question_id: uuid.UUID
    index: int | None = None
    answer_bool: bool | None = Field(default=None, alias="bool")
    text: str | None = None

    model_config = {"populate_by_name": True}


class SubmitIn(BaseModel):
    answers: list[AnswerIn]


class QuestionResult(BaseModel):
    question_id: uuid.UUID
    correct: bool
    correct_answer: dict
    explanation: str


class SubmitOut(BaseModel):
    score_pct: float
    passed: bool
    xp_awarded: int
    results: list[QuestionResult]
    new_badges: list[dict] = []


# ── Labs ──────────────────────────────────────────────────────────────


class LabStepOut(BaseModel):
    step_no: int
    instruction_md: str
    hint: str | None = None
    completed: bool = False


class LabOut(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    intro_md: str
    mode: str
    steps: list[LabStepOut]


class VerifyIn(BaseModel):
    command: str = Field(max_length=500)


class VerifyOut(BaseModel):
    correct: bool
    mock_output: str | None = None
    hint: str | None = None
    next_step: int | None = None
    xp_awarded: int = 0


# ── Progress / badges ─────────────────────────────────────────────────


class ModuleProgressOut(BaseModel):
    slug: str
    title: str
    icon: str
    pct: float
    lessons_done: int
    lessons_total: int
    lab_steps_done: int
    lab_steps_total: int
    quiz_passed: bool


class ActivityOut(BaseModel):
    kind: str
    xp_delta: int
    created_at: datetime


class BadgeOut(BaseModel):
    slug: str
    title: str
    description: str
    icon: str
    earned: bool
    awarded_at: datetime | None = None
