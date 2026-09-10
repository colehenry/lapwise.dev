"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type AppTheme,
  DEFAULT_THEME,
  isAppTheme,
  THEME_META_COLORS,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): AppTheme {
  if (typeof window.matchMedia !== "function") return DEFAULT_THEME;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_META_COLORS[theme]);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(DEFAULT_THEME);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {}

    // The init script already resolved this before paint; read it back rather
    // than deciding twice and risking the two disagreeing.
    const next = isAppTheme(stored)
      ? stored
      : isAppTheme(document.documentElement.dataset.theme)
        ? document.documentElement.dataset.theme
        : systemTheme();

    setThemeState(next);
    applyTheme(next);
  }, []);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
