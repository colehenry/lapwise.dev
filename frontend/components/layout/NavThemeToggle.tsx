"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import type { AppTheme } from "@/lib/theme";

/** Solid shapes: a stroked crescent at 16px reads as a smudge. */
function ThemeIcon({ theme }: { theme: AppTheme }) {
  if (theme === "light") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="3.6" fill="currentColor" />
        <path
          d="M10 1.6v2.2M10 16.2v2.2M18.4 10h-2.2M3.8 10H1.6M15.9 4.1l-1.5 1.5M5.6 14.4l-1.5 1.5M15.9 15.9l-1.5-1.5M5.6 5.6L4.1 4.1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }

  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.1 12.9A7.6 7.6 0 0 1 7.1 2.9a7.7 7.7 0 1 0 10 10Z"
      />
    </svg>
  );
}

export default function NavThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className="flex h-10 w-10 items-center justify-center rounded-sm text-ink-soft md:h-7 md:w-7 transition-colors hover:text-ink-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}
