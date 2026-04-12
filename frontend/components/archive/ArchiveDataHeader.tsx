import type { ReactNode } from "react";
import ArchivePanel from "@/components/archive/ArchivePanel";
import ArchiveStatTile from "@/components/archive/ArchiveStatTile";
import MonoLabel from "@/components/ui/MonoLabel";

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
  meta?: ReactNode;
  accentColor?: string | null;
};

export default function ArchiveDataHeader({
  title,
  eyebrow,
  subtitle,
  media,
  stats,
  meta,
  accentColor,
}: ArchiveDataHeaderProps) {
  return (
    <ArchivePanel bodyClassName="p-4 md:p-5">
      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-5">
        <div className="bg-bg-primary border border-border-primary rounded-sm h-[180px] lg:h-auto lg:min-h-[180px] flex items-center justify-center overflow-hidden">
          {media}
        </div>

        <div className="min-w-0 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="min-w-0">
              <MonoLabel className="block mb-2">{eyebrow}</MonoLabel>
              <h2 className="text-2xl md:text-3xl font-bold text-text-primary leading-tight break-words">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-2 text-sm text-text-tertiary">{subtitle}</p>
              )}
            </div>
            {meta && <div className="shrink-0">{meta}</div>}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            {stats.map((stat) => (
              <ArchiveStatTile
                key={stat.label}
                label={stat.label}
                value={stat.value}
                accentColor={accentColor}
              />
            ))}
          </div>
        </div>
      </div>
    </ArchivePanel>
  );
}
