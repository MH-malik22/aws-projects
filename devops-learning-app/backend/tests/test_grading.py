"""Unit tests for the quiz grading and lab command-matching logic."""

import uuid

from app.models import Question
from app.routers.labs import _command_matches
from app.routers.quizzes import _grade
from app.schemas import AnswerIn


def make_question(**kwargs) -> Question:
    defaults = dict(
        quiz_id=uuid.uuid4(),
        external_id="t-q1",
        qtype="mcq",
        difficulty="beginner",
        prompt="?",
        explanation="because",
        sort_order=1,
        case_sensitive=False,
    )
    defaults.update(kwargs)
    return Question(**defaults)


def test_mcq_correct_and_incorrect():
    q = make_question(qtype="mcq", options=["a", "b", "c"], correct_index=1)
    qid = uuid.uuid4()
    ok, correct = _grade(q, AnswerIn(question_id=qid, index=1))
    assert ok and correct == {"index": 1}
    ok, _ = _grade(q, AnswerIn(question_id=qid, index=0))
    assert not ok


def test_mcq_unanswered_is_wrong():
    q = make_question(qtype="mcq", options=["a", "b"], correct_index=0)
    ok, _ = _grade(q, AnswerIn(question_id=uuid.uuid4()))
    assert not ok


def test_true_false():
    q = make_question(qtype="true_false", correct_bool=False)
    qid = uuid.uuid4()
    assert _grade(q, AnswerIn(question_id=qid, answer_bool=False))[0]
    assert not _grade(q, AnswerIn(question_id=qid, answer_bool=True))[0]


def test_command_whitespace_and_case_insensitive():
    q = make_question(qtype="command", accepted_answers=["docker ps -a", "docker container ls -a"])
    qid = uuid.uuid4()
    assert _grade(q, AnswerIn(question_id=qid, text="  docker   ps   -a "))[0]
    assert _grade(q, AnswerIn(question_id=qid, text="DOCKER PS -A"))[0]
    assert _grade(q, AnswerIn(question_id=qid, text="docker container ls -a"))[0]
    assert not _grade(q, AnswerIn(question_id=qid, text="docker ps"))[0]


def test_command_case_sensitive_flag():
    q = make_question(qtype="command", accepted_answers=["git rebase -i HEAD~3"], case_sensitive=True)
    qid = uuid.uuid4()
    assert _grade(q, AnswerIn(question_id=qid, text="git rebase -i HEAD~3"))[0]
    assert not _grade(q, AnswerIn(question_id=qid, text="git rebase -i head~3"))[0]


def test_lab_command_literal_and_regex():
    expected = ["df -h", "/du -sh \\/var\\/\\*.*/"]
    assert _command_matches("df -h", expected)
    assert _command_matches("  df   -h ", expected)
    assert _command_matches("du -sh /var/*", expected)
    assert not _command_matches("df", expected)
