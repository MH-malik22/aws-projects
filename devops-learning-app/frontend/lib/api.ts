/** Typed API client for the DevOps Academy backend. */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("access_token");
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && typeof window !== "undefined") {
    // access token expired → try one refresh, then redirect to login
    const refreshed = await tryRefresh();
    if (refreshed) return api<T>(path, init);
    window.location.href = "/login";
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  const refresh = sessionStorage.getItem("refresh_token");
  if (!refresh) return false;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  sessionStorage.setItem("access_token", data.access_token);
  sessionStorage.setItem("refresh_token", data.refresh_token);
  return true;
}

export const fetcher = <T>(path: string) => api<T>(path);

// ── Shared types (mirror backend schemas.py) ─────────────────────────

export interface ModuleSummary {
  slug: string;
  title: string;
  description: string;
  icon: string;
  difficulty: string;
  est_hours: number;
  lessons: number;
  labs: number;
  progress_pct: number | null;
}

export interface QuestionPublic {
  id: string;
  external_id: string;
  qtype: "mcq" | "true_false" | "scenario" | "command";
  difficulty: string;
  prompt: string;
  options: string[] | null;
}

export interface QuizOut {
  quiz_id: string;
  title: string;
  pass_threshold: number;
  questions: QuestionPublic[];
}

export interface SubmitResult {
  score_pct: number;
  passed: boolean;
  xp_awarded: number;
  results: {
    question_id: string;
    correct: boolean;
    correct_answer: Record<string, unknown>;
    explanation: string;
  }[];
  new_badges: { slug: string; title: string }[];
}

export interface LabStep {
  step_no: number;
  instruction_md: string;
  hint: string | null;
  completed: boolean;
}

export interface Lab {
  id: string;
  slug: string;
  title: string;
  intro_md: string;
  mode: "simulated" | "container";
  steps: LabStep[];
}
