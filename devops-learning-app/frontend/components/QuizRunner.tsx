"use client";

import { useState } from "react";
import { api, QuizOut, SubmitResult } from "@/lib/api";

type Answer = { index?: number; bool?: boolean; text?: string };

export function QuizRunner({ quiz }: { quiz: QuizOut }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const q = quiz.questions[current];
  const answered = Object.keys(answers).length;

  async function start() {
    const res = await api<{ attempt_id: string }>(`/quizzes/${quiz.quiz_id}/attempts`, {
      method: "POST",
    });
    setAttemptId(res.attempt_id);
  }

  async function submit() {
    if (!attemptId) return;
    setSubmitting(true);
    try {
      const res = await api<SubmitResult>(`/attempts/${attemptId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          answers: quiz.questions.map((question) => ({
            question_id: question.id,
            ...answers[question.id],
          })),
        }),
      });
      setResult(res);
    } finally {
      setSubmitting(false);
    }
  }

  if (!attemptId) {
    return (
      <div className="card text-center">
        <h2 className="text-xl font-semibold">{quiz.title}</h2>
        <p className="mt-2 text-slate-500">
          {quiz.questions.length} questions · pass at {quiz.pass_threshold}%
        </p>
        <button className="btn-primary mt-4" onClick={start}>
          Start quiz
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className={`card text-center ${result.passed ? "border-emerald-400" : "border-rose-400"}`}>
          <p className="text-4xl font-bold">{result.score_pct}%</p>
          <p className="mt-1 font-medium">{result.passed ? "Passed 🎉" : "Not yet — review and retake"}</p>
          {result.xp_awarded > 0 && <p className="text-sm text-emerald-600">+{result.xp_awarded} XP</p>}
        </div>
        {quiz.questions.map((question, i) => {
          const r = result.results.find((x) => x.question_id === question.id);
          if (!r) return null;
          return (
            <div key={question.id} className="card">
              <p className="font-medium">
                {i + 1}. {question.prompt}{" "}
                <span className={r.correct ? "text-emerald-600" : "text-rose-600"}>
                  {r.correct ? "✓" : "✗"}
                </span>
              </p>
              <p className="mt-2 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
                <strong>Explanation:</strong> {r.explanation}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  const setAnswer = (a: Answer) => setAnswers({ ...answers, [q.id]: a });
  const a = answers[q.id] ?? {};

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          Question {current + 1} / {quiz.questions.length}
        </span>
        <span className="chip bg-slate-100 dark:bg-slate-800">{q.qtype.replace("_", "/")}</span>
      </div>
      <p className="mb-4 text-lg font-medium">{q.prompt}</p>

      {(q.qtype === "mcq" || q.qtype === "scenario") &&
        q.options?.map((opt, i) => (
          <button
            key={i}
            onClick={() => setAnswer({ index: i })}
            className={`mb-2 block w-full rounded-lg border p-3 text-left transition ${
              a.index === i
                ? "border-brand bg-indigo-50 dark:bg-indigo-950/40"
                : "border-slate-200 hover:border-slate-400 dark:border-slate-700"
            }`}
          >
            <span className="mr-2 font-mono text-slate-400">{i + 1}.</span>
            {opt}
          </button>
        ))}

      {q.qtype === "true_false" && (
        <div className="flex gap-3">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              onClick={() => setAnswer({ bool: v })}
              className={`flex-1 rounded-lg border p-4 font-medium ${
                a.bool === v
                  ? "border-brand bg-indigo-50 dark:bg-indigo-950/40"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              {v ? "True" : "False"}
            </button>
          ))}
        </div>
      )}

      {q.qtype === "command" && (
        <div className="flex items-center rounded-lg bg-slate-900 p-3 font-mono text-emerald-400">
          <span className="mr-2 select-none">$</span>
          <input
            value={a.text ?? ""}
            onChange={(e) => setAnswer({ text: e.target.value })}
            className="w-full bg-transparent outline-none placeholder:text-slate-600"
            placeholder="type the command…"
            spellCheck={false}
          />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          className="text-sm text-slate-500 disabled:opacity-40"
          disabled={current === 0}
          onClick={() => setCurrent(current - 1)}
        >
          ← Back
        </button>
        {current < quiz.questions.length - 1 ? (
          <button className="btn-primary" onClick={() => setCurrent(current + 1)}>
            Next →
          </button>
        ) : (
          <button
            className="btn-primary"
            disabled={submitting || answered < quiz.questions.length}
            onClick={submit}
          >
            {answered < quiz.questions.length
              ? `Answer all (${answered}/${quiz.questions.length})`
              : "Submit"}
          </button>
        )}
      </div>
    </div>
  );
}
