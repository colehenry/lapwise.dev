import type { ChartConfig } from "./chat";
import { darken, resolveReadableAccentColor } from "./color-utils";
import { SERIES_COLORS } from "./palette";
import type { EntityColors } from "./queries/standings";
import type { AppTheme } from "./theme";

function readableColor(
  color: string | undefined,
  theme: AppTheme,
  fallback: string,
): string {
  if (!color) return fallback;
  if (color.startsWith("var(")) return color;
  return resolveReadableAccentColor(color, theme) ?? fallback;
}

function distinguishRepeatedColors(colors: string[]): string[] {
  const uses = new Map<string, number>();
  return colors.map((color) => {
    const use = uses.get(color) ?? 0;
    uses.set(color, use + 1);
    return use > 0 && color.startsWith("#") ? darken(color, 0.3 * use) : color;
  });
}

export interface AIChartPalette {
  series: string[];
  categories: string[] | null;
}

export function resolveAIChartPalette(
  config: ChartConfig,
  entityColors: EntityColors,
  theme: AppTheme,
): AIChartPalette {
  const series = distinguishRepeatedColors(
    config.yKeys.map((key, index) => {
      const label = config.seriesLabels?.[index];
      const color =
        config.seriesColors?.[key] ??
        entityColors.driverColors.get(key) ??
        entityColors.teamColors.get(key) ??
        (label ? entityColors.teamColors.get(label) : undefined) ??
        config.colors[index];
      return readableColor(
        color,
        theme,
        SERIES_COLORS[index % SERIES_COLORS.length],
      );
    }),
  );

  const categoryCandidates = config.data.map((row, index) => {
    const category = String(row[config.xKey] ?? "");
    const explicit = config.categoryColors?.[category];
    const entity =
      entityColors.teamColors.get(category) ??
      entityColors.driverColors.get(category);
    const color = explicit ?? entity;
    return color
      ? readableColor(color, theme, SERIES_COLORS[index % SERIES_COLORS.length])
      : null;
  });
  const hasSemanticCategoryColor = categoryCandidates.some(Boolean);

  return {
    series,
    categories: hasSemanticCategoryColor
      ? distinguishRepeatedColors(
          categoryCandidates.map(
            (color, index) =>
              color ?? SERIES_COLORS[index % SERIES_COLORS.length],
          ),
        )
      : null,
  };
}
