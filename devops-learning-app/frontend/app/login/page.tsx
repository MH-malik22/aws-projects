"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Login failed");
      const data = await res.json();
      sessionStorage.setItem("access_token", data.access_token);
      sessionStorage.setItem("refresh_token", data.refresh_token);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-bold">Sign in</h1>
      <form onSubmit={submit} className="space-y-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-transparent p-3 dark:border-slate-700"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-transparent p-3 dark:border-slate-700"
        />
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
