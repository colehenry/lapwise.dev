export const THEME_STORAGE_KEY = "lapwise-theme";

export const APP_THEMES = ["dark", "light"] as const;

export type AppTheme = (typeof APP_THEMES)[number];

export const DEFAULT_THEME: AppTheme = "dark";

export const THEME_META_COLORS: Record<AppTheme, string> = {
  dark: "#0a0a0f",
  light: "#f5f1ea",
};

export function isAppTheme(
  value: string | null | undefined,
): value is AppTheme {
  return value === "dark" || value === "light";
}

export function getThemeInitScript() {
  return `(() => {
    const storageKey = "${THEME_STORAGE_KEY}";
    const fallback = "${DEFAULT_THEME}";
    let theme = fallback;

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "dark" || stored === "light") {
        theme = stored;
      }
    } catch {}

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
