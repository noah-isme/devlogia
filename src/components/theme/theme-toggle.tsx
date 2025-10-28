"use client";

import { useId } from "react";

import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const labelId = useId();

  return (
    <button
      type="button"
      aria-labelledby={labelId}
      aria-pressed={theme === "dark"}
      onClick={toggleTheme}
      className="group inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-foreground/60 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span aria-hidden className="relative block h-4 w-4">
        <span
          className="absolute inset-0 rounded-full border border-border bg-background transition group-hover:border-primary"
        />
        <span
          className="absolute inset-1 rounded-full bg-gradient-to-br from-primary/90 via-primary/70 to-primary/40 opacity-0 transition group-hover:opacity-100"
        />
      </span>
      <span id={labelId} className="uppercase tracking-wide">
        {theme === "dark" ? "Dark" : "Light"} mode
      </span>
    </button>
  );
}
