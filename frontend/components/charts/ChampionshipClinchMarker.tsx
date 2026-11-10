"use client";

import { ReferenceDot } from "recharts";
import type { ProgressionChartPoint } from "@/lib/queries/pointsProgression";

type ChampionshipClinchMarkerProps = {
  /** Round the title became certain, as the progression reports it. */
  clinchedRound: number | null;
  /** The champion's series key, which is also their dataKey in the chart. */
  seriesKey: string | null;
  chartData: ProgressionChartPoint[];
  label: string;
};

/**
 * A trophy on the round a championship stopped being winnable by anyone else.
 *
 * Recharts reads `ReferenceDot` from the chart's own children, so this returns
 * one rather than wrapping it — a wrapper element would be invisible to the
 * chart. It resolves its own y from the champion's line, so the trophy sits on
 * the line instead of floating in the plot area.
 */
export default function ChampionshipClinchMarker({
  clinchedRound,
  seriesKey,
  chartData,
  label,
}: ChampionshipClinchMarkerProps) {
  if (clinchedRound === null || !seriesKey) return null;

  const round = String(clinchedRound);
  const point = chartData.find((entry) => entry.round === round);
  const y = point?.[seriesKey];
  if (typeof y !== "number") return null;

  return (
    <ReferenceDot
      x={round}
      y={y}
      r={0}
      ifOverflow="extendDomain"
      label={{
        value: "🏆",
        position: "top",
        fontSize: 18,
        offset: 10,
        "aria-label": label,
      }}
    />
  );
}
