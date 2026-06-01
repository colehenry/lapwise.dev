// Values resolve per theme from the CSS custom properties in app/globals.css.

export const COMPOUND_COLORS: Record<string, string> = {
  SUPERSOFT: "var(--compound-supersoft)",
  SOFT: "var(--compound-soft)",
  MEDIUM: "var(--compound-medium)",
  HARD: "var(--compound-hard)",
  INTERMEDIATE: "var(--compound-inter)",
  WET: "var(--compound-wet)",
};

export const getCompoundColor = (compound: string | null | undefined): string =>
  COMPOUND_COLORS[compound ?? ""] ?? "var(--delta-neutral)";

export const POSITION_COLORS = {
  gold: "var(--pos-gold)",
  silver: "var(--pos-silver)",
  bronze: "var(--pos-bronze)",
  points: "var(--pos-points)",
  outPoints: "var(--pos-outpoints)",
} as const;

export const DELTA_COLORS = {
  faster: "var(--delta-faster)",
  slower: "var(--delta-slower)",
  neutral: "var(--delta-neutral)",
} as const;

export const STATUS_COLORS = {
  yellow: "var(--status-yellow)",
  safetyCar: "var(--status-sc)",
  virtualSafetyCar: "var(--status-vsc)",
  red: "var(--status-red)",
  pit: "var(--status-pit)",
} as const;

export const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
] as const;

export const seriesColor = (index: number): string =>
  SERIES_COLORS[index % SERIES_COLORS.length];

// Third-party brand colors are fixed by the vendor and do not change per theme.
export const BRAND = {
  google: {
    blue: "#4285f4",
    red: "#ea4335",
    yellow: "#fbbc05",
    green: "#34a853",
  },
} as const;

export const DEFAULT_TAG_COLOR = "#8b5cf6";

export const BG_THEME_COLOR = {
  dark: "#0a0a0f",
  light: "#f6f7fb",
} as const;

export const resolveToken = (token: string): string => {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
};
