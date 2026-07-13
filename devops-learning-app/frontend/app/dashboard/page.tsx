"use client";

import useSWR from "swr";
import Link from "next/link";
import { fetcher, ModuleSummary } from "@/lib/api";
import { ModuleCard } from "@/components/ModuleCard";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Me {
  display_name: string;
  xp: number;
}

export default function DashboardPage() {
  const { data: me } = useSWR<Me>("/auth/me", fetcher);
  const { data: modules } = useSWR<ModuleSummary[]>("/modules", fetcher);

  const level = me ? Math.floor(Math.sqrt(me.xp / 100)) + 1 : 1;
  const inProgress = modules?.filter(
    (m) => (m.progress_pct ?? 0) > 0 && (m.progress_pct ?? 0) < 100,
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Hello, {me?.display_name ?? "learner"} 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Level {level} · {me?.xp ?? 0} XP
          </p>
        </div>
        <ThemeToggle />
      </header>

      {inProgress && inProgress.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">Continue learning</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {inProgress.slice(0, 2).map((m) => (
              <Link key={m.slug} href={`/modules/${m.slug}`} className="card flex items-center gap-4 hover:border-brand">
                <span className="text-3xl">{m.icon}</span>
                <div className="flex-1">
                  <p className="font-medium">{m.title}</p>
                  <div className="mt-2 h-2 rounded bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-2 rounded bg-brand dark:bg-brand-dark"
                      style={{ width: `${m.progress_pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm text-slate-500">{m.progress_pct}%</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">All modules</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules?.map((m) => <ModuleCard key={m.slug} module={m} />)}
        </div>
      </section>
    </main>
  );
}
