"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import { fetcher, QuizOut } from "@/lib/api";
import { QuizRunner } from "@/components/QuizRunner";

export default function QuizPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: quiz, error } = useSWR<QuizOut>(`/modules/${slug}/quiz`, fetcher);

  if (error) return <main className="p-8 text-rose-500">Failed to load quiz.</main>;
  if (!quiz) return <main className="p-8 text-slate-500">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <QuizRunner quiz={quiz} />
    </main>
  );
}
