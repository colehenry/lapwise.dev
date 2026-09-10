export const THEME_STORAGE_KEY = "lapwise-theme";

export const APP_THEMES = ["dark", "light"] as const;
export type AppTheme = (typeof APP_THEMES)[number];

/** Only used when the visitor has not chosen and the OS will not say. */
export const DEFAULT_THEME: AppTheme = "dark";

/** Browser chrome matches `--surface-page`; the two used to disagree. */
export const THEME_META_COLORS: Record<AppTheme, string> = {
  dark: "#0a0a0f",
  light: "#f6f7fb",
};

export function isAppTheme(
  value: string | null | undefined,
): value is AppTheme {
  return value === "dark" || value === "light";
}

/**
 * Runs before first paint, because a theme resolved late is a visible flash.
 * With nothing stored it takes the operating system's answer, so a first visit
 * matches the machine it arrives on; an explicit choice is stored and wins from
 * then on.
 */
export function getThemeInitScript() {
  return `(() => {
    const storageKey = "${THEME_STORAGE_KEY}";
    let theme = null;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "dark" || stored === "light") theme = stored;
    } catch {}

    if (!theme) {
      const prefersLight =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: light)").matches;
      theme = prefersLight ? "light" : "${DEFAULT_THEME}";
    }

    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        "content",
        theme === "light" ? "${THEME_META_COLORS.light}" : "${THEME_META_COLORS.dark}",
      );
    }
  })();`;
}
