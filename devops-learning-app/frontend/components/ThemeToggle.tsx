"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="h-9 w-9" />;

  const dark = resolvedTheme === "dark";
  return (
    <button
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
