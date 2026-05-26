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
  DEFAULT_THEME,
  isAppTheme,
  THEME_META_COLORS,
  THEME_STORAGE_KEY,
  type AppTheme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", THEME_META_COLORS[theme]);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(DEFAULT_THEME);

  useEffect(() => {
    let nextTheme = DEFAULT_THEME;

    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isAppTheme(stored)) {
        nextTheme = stored;
      } else if (isAppTheme(document.documentElement.dataset.theme)) {
        nextTheme = document.documentElement.dataset.theme;
      }
    } catch {
      if (isAppTheme(document.documentElement.dataset.theme)) {
        nextTheme = document.documentElement.dataset.theme;
      }
    }

    applyTheme(nextTheme);
    setThemeState(nextTheme);
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
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
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
