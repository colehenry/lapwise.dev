import type { ReactNode } from "react";
import MonoLabel from "@/components/ui/MonoLabel";
import ArchivePanel from "./ArchivePanel";

type ArchiveHeaderStat = {
  label: string;
  value: string | number;
};

type ArchiveDataHeaderProps = {
  title: string;
  eyebrow: string;
  subtitle?: string;
  media: ReactNode;
  stats: ArchiveHeaderStat[];
  headlineStats?: ArchiveHeaderStat[];
  meta?: ReactNode;
  accentColor?: string | null;
  bannerImageUrl?: string | null;
  aside?: ReactNode;
};

function formatStatValue(value: string | number): string | number {
  if (typeof value !== "number") return value;
  return Number.isInteger(value) ? value.toLocaleString() : value;
}

export default function ArchiveDataHeader({
  title,
  eyebrow,
  subtitle,
  media,
  stats,
  headlineStats = [],
  meta,
  accentColor,
  bannerImageUrl,
  aside,
}: ArchiveDataHeaderProps) {
  const statGridClass =
    stats.length > 4
      ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
      : stats.length === 4
        ? "grid-cols-2 sm:grid-cols-4"
        : stats.length === 3
          ? "grid-cols-3"
          : "grid-cols-2";

  const gridCols = aside
    ? "grid-cols-1 lg:grid-cols-[220px_1fr_220px]"
    : "grid-cols-1 lg:grid-cols-[220px_1fr]";

  const headlineTextSize = aside
    ? "text-3xl md:text-4xl"
    : "text-4xl md:text-5xl";

  const statTextSize = aside ? "text-base md:text-lg" : "text-lg md:text-xl";

  return (
    <ArchivePanel bodyClassName="p-0">
      <div
        className="h-1 w-full bg-border-secondary"
        style={accentColor ? { backgroundColor: accentColor } : undefined}
      />
      <div className={`relative grid ${gridCols} gap-0 overflow-hidden`}>
        {bannerImageUrl && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center opacity-15"
              style={{ backgroundImage: `url(${bannerImageUrl})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-bg-tertiary via-bg-tertiary/95 to-bg-tertiary/75" />
          </>
        )}
        <div className="bg-bg-primary/70 border-b lg:border-b-0 lg:border-r border-border-primary h-[220px] lg:h-auto lg:max-h-[360px] flex items-end justify-center overflow-hidden">
          <div className="relative z-10 h-full w-full flex items-center justify-center">
            {media}
          </div>
        </div>

        <div className="relative z-10 min-w-0 p-5 md:p-6 flex flex-col gap-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <MonoLabel className="block mb-2">{eyebrow}</MonoLabel>
              <h2 className="text-3xl md:text-4xl font-bold text-text-primary leading-tight break-words">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-2 text-sm md:text-base text-text-tertiary">
                  {subtitle}
                </p>
              )}
            </div>
            {meta && <div className="shrink-0">{meta}</div>}
          </div>

          {headlineStats.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {headlineStats.map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <MonoLabel className="block mb-2">{stat.label}</MonoLabel>
                  <div
                    className={`${headlineTextSize} font-bold font-mono tabular-nums text-text-primary truncate`}
                  >
                    {formatStatValue(stat.value)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            className={`grid ${statGridClass} border-y border-border-primary bg-bg-primary/20`}
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="min-w-0 border border-border-primary px-3 py-2.5"
              >
                <MonoLabel className="block mb-1 break-words">
                  {stat.label}
                </MonoLabel>
                <div
                  className={`${statTextSize} font-bold font-mono tabular-nums text-text-primary truncate`}
                >
                  {formatStatValue(stat.value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {aside && (
          <div className="relative z-10 border-t lg:border-t-0 lg:border-l border-border-primary p-5 md:p-6 flex flex-col gap-3 lg:max-h-[360px] overflow-y-auto">
            {aside}
          </div>
        )}
      </div>
    </ArchivePanel>
  );
}
