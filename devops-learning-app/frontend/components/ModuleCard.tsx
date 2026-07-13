import Link from "next/link";
import { ModuleSummary } from "@/lib/api";

const difficultyColor: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  intermediate: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  advanced: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

export function ModuleCard({ module: m }: { module: ModuleSummary }) {
  return (
    <Link href={`/modules/${m.slug}`} className="card block transition hover:border-brand hover:shadow-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xl">{m.icon}</span>
        <span className={`chip ${difficultyColor[m.difficulty]}`}>{m.difficulty}</span>
      </div>
      <h3 className="font-semibold">{m.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{m.description}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          {m.lessons} lessons · {m.labs} labs · ~{m.est_hours}h
        </span>
        {m.progress_pct !== null && <span className="font-medium">{m.progress_pct}%</span>}
      </div>
      {m.progress_pct !== null && (
        <div className="mt-2 h-1.5 rounded bg-slate-200 dark:bg-slate-800">
          <div
            className="h-1.5 rounded bg-brand dark:bg-brand-dark"
            style={{ width: `${m.progress_pct}%` }}
          />
        </div>
      )}
    </Link>
  );
}
