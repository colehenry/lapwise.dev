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

export function darken(hex: string, amount: number): string {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return hex;
  const factor = Math.max(0, Math.min(1, 1 - amount));
  const r = Math.round(Number.parseInt(normalized.slice(1, 3), 16) * factor);
  const g = Math.round(Number.parseInt(normalized.slice(3, 5), 16) * factor);
  const b = Math.round(Number.parseInt(normalized.slice(5, 7), 16) * factor);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
