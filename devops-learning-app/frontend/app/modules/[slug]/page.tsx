"use client";

import useSWR from "swr";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetcher } from "@/lib/api";

interface ModuleDetail {
  slug: string;
  title: string;
  icon: string;
  description: string;
  difficulty: string;
  est_hours: number;
  progress_pct: number | null;
  lesson_list: { slug: string; title: string; completed: boolean }[];
  lab_list: { id: string; title: string; steps: number; steps_done: number }[];
  quiz: { quiz_id: string; title: string; questions: number; best_pct: number | null; passed: boolean | null } | null;
}

export default function ModulePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: m } = useSWR<ModuleDetail>(`/modules/${slug}`, fetcher);

  if (!m) return <main className="p-8 text-slate-500">Loading…</main>;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-8">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{m.icon}</span>
          <div>
            <h1 className="text-2xl font-bold">{m.title}</h1>
            <p className="text-slate-500 dark:text-slate-400">{m.description}</p>
          </div>
        </div>
        {m.progress_pct !== null && (
          <div className="mt-4 h-2 rounded bg-slate-200 dark:bg-slate-800">
            <div className="h-2 rounded bg-brand" style={{ width: `${m.progress_pct}%` }} />
          </div>
        )}
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Lessons</h2>
        <ol className="space-y-2">
          {m.lesson_list.map((l, i) => (
            <li key={l.slug}>
              <Link
                href={`/modules/${m.slug}/lessons/${l.slug}`}
                className="card flex items-center gap-3 py-3 hover:border-brand"
              >
                <span className={l.completed ? "text-emerald-500" : "text-slate-300"}>
                  {l.completed ? "✓" : `${i + 1}.`}
                </span>
                {l.title}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Labs</h2>
        {m.lab_list.map((lab) => (
          <Link key={lab.id} href={`/labs/${lab.id}`} className="card mb-2 flex items-center justify-between hover:border-brand">
            <span>🧪 {lab.title}</span>
            <span className="text-sm text-slate-500">
              {lab.steps_done}/{lab.steps} steps
            </span>
          </Link>
        ))}
      </section>

      {m.quiz && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Quiz</h2>
          <Link href={`/modules/${m.slug}/quiz`} className="card flex items-center justify-between hover:border-brand">
            <span>📝 {m.quiz.title} · {m.quiz.questions} questions</span>
            <span className="text-sm">
              {m.quiz.passed ? `✓ passed (best ${m.quiz.best_pct}%)` : m.quiz.best_pct !== null ? `best ${m.quiz.best_pct}%` : "Start →"}
            </span>
          </Link>
        </section>
      )}
    </main>
  );
}
