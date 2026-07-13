"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { api, Lab } from "@/lib/api";

interface VerifyOut {
  correct: boolean;
  mock_output: string | null;
  hint: string | null;
  next_step: number | null;
  xp_awarded: number;
}

/** Simulated-terminal lab: instructions on the left, terminal pane on the right. */
export function LabTerminal({ lab }: { lab: Lab }) {
  const firstIncomplete =
    lab.steps.find((s) => !s.completed)?.step_no ?? lab.steps.length;
  const [stepNo, setStepNo] = useState(firstIncomplete);
  const [lines, setLines] = useState<string[]>(["Welcome to the lab terminal."]);
  const [input, setInput] = useState("");
  const [fails, setFails] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [done, setDone] = useState(false);

  const step = lab.steps.find((s) => s.step_no === stepNo);

  async function run() {
    if (!input.trim() || !step) return;
    const cmd = input;
    setInput("");
    setLines((l) => [...l, `$ ${cmd}`]);
    try {
      const res = await api<VerifyOut>(`/labs/${lab.id}/steps/${step.step_no}/verify`, {
        method: "POST",
        body: JSON.stringify({ command: cmd }),
      });
      if (res.correct) {
        setLines((l) => [...l, ...(res.mock_output ? res.mock_output.split("\n") : []), "✔ step complete" + (res.xp_awarded ? ` (+${res.xp_awarded} XP)` : "")]);
        setFails(0);
        setShowHint(false);
        if (res.next_step) setStepNo(res.next_step);
        else setDone(true);
      } else {
        setLines((l) => [...l, "✗ not quite — try again"]);
        setFails((f) => f + 1);
      }
    } catch (e) {
      setLines((l) => [...l, `error: ${(e as Error).message}`]);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card">
        <p className="mb-2 text-sm text-slate-500">
          Step {stepNo} of {lab.steps.length}
        </p>
        <div className="mb-3 flex gap-1">
          {lab.steps.map((s) => (
            <span
              key={s.step_no}
              className={`h-2 flex-1 rounded ${
                s.step_no < stepNo || done ? "bg-emerald-500" : s.step_no === stepNo ? "bg-brand" : "bg-slate-200 dark:bg-slate-800"
              }`}
            />
          ))}
        </div>
        {done ? (
          <p className="font-medium text-emerald-600">Lab complete 🎉</p>
        ) : (
          <>
            <div className="prose prose-sm dark:prose-invert">
              <ReactMarkdown>{step?.instruction_md ?? ""}</ReactMarkdown>
            </div>
            {step?.hint && fails >= 2 && !showHint && (
              <button className="mt-3 text-sm text-brand" onClick={() => setShowHint(true)}>
                💡 Show hint
              </button>
            )}
            {showHint && step?.hint && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/40">💡 {step.hint}</p>
            )}
          </>
        )}
      </div>

      <div className="flex h-80 flex-col rounded-xl bg-slate-950 p-4 font-mono text-sm text-emerald-400">
        <div className="flex-1 space-y-0.5 overflow-y-auto whitespace-pre-wrap">
          {lines.map((l, i) => (
            <div key={i} className={l.startsWith("✗") ? "text-rose-400" : l.startsWith("✔") ? "text-emerald-300" : ""}>
              {l}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center border-t border-slate-800 pt-2">
          <span className="mr-2 select-none">$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            disabled={done}
            className="w-full bg-transparent outline-none placeholder:text-slate-600"
            placeholder={done ? "lab complete" : "type a command and press Enter"}
            spellCheck={false}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
