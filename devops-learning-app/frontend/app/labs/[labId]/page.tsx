"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { fetcher, Lab } from "@/lib/api";
import { LabTerminal } from "@/components/LabTerminal";

export default function LabPage() {
  const { labId } = useParams<{ labId: string }>();
  const { data: lab } = useSWR<Lab>(`/labs/${labId}`, fetcher);

  if (!lab) return <main className="p-8 text-slate-500">Loading…</main>;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-2 text-2xl font-bold">{lab.title}</h1>
      <div className="prose prose-sm mb-6 dark:prose-invert">
        <ReactMarkdown>{lab.intro_md}</ReactMarkdown>
      </div>
      <LabTerminal lab={lab} />
    </main>
  );
}
