import type { AppTheme } from "@/lib/theme";

export function normalizeHexColor(
  hex: string | null | undefined,
): string | null {
  if (!hex) return null;
  const value = hex.startsWith("#") ? hex.slice(1) : hex;
  if (!/^[\da-f]{6}$/i.test(value)) return null;
  return `#${value}`;
}

export function getRelativeLuminance(hex: string): number {
  const normalized = hex.slice(1);
  const channels = [0, 2, 4].map((offset) => {
    const channel =
      Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function resolveReadableAccentColor(
  color: string | null | undefined,
  theme: AppTheme,
  lightModeFallback = "#334155",
): string | null {
  const normalized = normalizeHexColor(color);
  if (!normalized) return null;

  if (theme === "light" && getRelativeLuminance(normalized) > 0.82) {
    return lightModeFallback;
  }

  return normalized;
}
