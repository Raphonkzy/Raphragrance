"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as
        | "light"
        | "dark") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    setTheme(current);
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("rph-theme", next);
    } catch {}
  }

  // Label shows the theme it will switch TO ("Dark" / "Light")
  const targetLabel = !mounted
    ? "Dark"
    : theme === "dark"
    ? "Light"
    : "Dark";

  return (
    <button
      type="button"
      className="chip theme-toggle-chip"
      onClick={toggle}
      aria-label={`Switch to ${targetLabel} theme`}
    >
      {targetLabel}
    </button>
  );
}
