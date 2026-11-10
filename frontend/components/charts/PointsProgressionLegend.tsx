"use client";

import type {
  ConstructorProgression,
  DriverProgression,
} from "@/lib/queries/pointsProgression";
import { CHART_TYPOGRAPHY } from "./chart-primitives";

type Entity = DriverProgression | ConstructorProgression;

type PointsProgressionLegendProps = {
  entities: Entity[];
  seriesKey: (entity: Entity) => string;
  seriesName: (entity: Entity) => string;
  seriesColor: (entity: Entity) => string;
  championKey: string | null;
};

/** The chart's key, over the plot area. The champion carries the trophy. */
export default function PointsProgressionLegend({
  entities,
  seriesKey,
  seriesName,
  seriesColor,
  championKey,
}: PointsProgressionLegendProps) {
  return (
    <div className="absolute top-8 left-25 bg-surface-page/90 border border-line-soft rounded-sm p-3 backdrop-blur-sm pointer-events-none">
      <div className="flex flex-col gap-1.5">
        {entities.map((entity) => {
          const key = seriesKey(entity);
          return (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: seriesColor(entity) }}
              />
              <span className={CHART_TYPOGRAPHY.keyClassName}>
                {seriesName(entity)}
              </span>
              {key === championKey && (
                <span aria-hidden="true" className="text-[11px] leading-none">
                  🏆
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
