"use client";

import { useQuery } from "@tanstack/react-query";
import CrossSessionComparison from "@/components/CrossSessionComparison";
import FastestLapTimeline from "@/components/FastestLapTimeline";
import LapTimeByLapGraph from "@/components/LapTimeByLapGraph";
import LapTimeDistributionChart from "@/components/LapTimeDistributionChart";
import LongRunPaceChart from "@/components/LongRunPaceChart";
import PitStopDeltaChart from "@/components/PitStopDeltaChart";
import PointsByRoundGraph from "@/components/PointsByRoundGraph";
import PracticeSectorHeatmap from "@/components/PracticeSectorHeatmap";
import QualifyingProgressionChart from "@/components/QualifyingProgressionChart";
import QualifyingSectorComparison from "@/components/QualifyingSectorComparison";
import QualifyingSectorHeatmap from "@/components/QualifyingSectorHeatmap";
import RaceTrackEvolutionChart from "@/components/RaceTrackEvolutionChart";
import SpeedTrapChart from "@/components/SpeedTrapChart";
import TeammateHeadToHead from "@/components/TeammateHeadToHead";
import TrackEvolutionChart from "@/components/TrackEvolutionChart";
import TyreDegradationChart from "@/components/TyreDegradationChart";
import TyreProgrammeChart from "@/components/TyreProgrammeChart";
import TyreStintChart from "@/components/TyreStintChart";
import WeatherChart from "@/components/WeatherChart";
import { apiHeaders, apiUrl } from "@/lib/api";
import { getDiscussionEmbed } from "@/lib/discussionEmbedRegistry";
import type { SessionResultsResponse } from "@/lib/types";

export interface DiscussionEmbedAttrs {
  type?: string;
  season?: string;
  round?: string;
  title?: string;
  view?: string;
  drivers?: string;
  entities?: string;
  isSprint?: string;
  practiceSession?: string;
  mode?: string;
  pointsType?: string;
  limit?: string;
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "yes";
}

function parseDrivers(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const drivers = value
    .split(",")
    .map((driver) => driver.trim())
    .filter(Boolean);
  return drivers.length > 0 ? drivers : undefined;
}

function EmbedShell({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-6 overflow-hidden rounded-sm border border-border-primary bg-bg-tertiary">
      {title && (
        <div className="border-b border-border-primary bg-bg-primary px-4 py-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">
            {title}
          </p>
        </div>
      )}
      <div className="p-4 md:p-5">{children}</div>
    </div>
  );
}

function EmbedError({ message }: { message: string }) {
  return (
    <div className="my-4 rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}

function RaceResultsEmbed({
  season,
  round,
  type,
  limit,
}: {
  season: number;
  round: number;
  type: string;
  limit: number;
}) {
  const { data, isLoading } = useQuery<SessionResultsResponse | null>({
    queryKey: ["discussion-results-table", season, round, type],
    queryFn: async () => {
      const suffix =
        type === "sprint-results"
          ? "/sprint"
          : type === "qualifying-results"
            ? "/qualifying"
            : type === "sprint-qualifying-results"
              ? "/sprint-qualifying"
              : "";
      const endpoint = `/api/results/${season}/${round}${suffix}`;
      const res = await fetch(apiUrl(endpoint), {
        cache: "no-store",
        headers: apiHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (isLoading) {
    return <p className="text-sm text-text-muted">Loading results...</p>;
  }

  if (!data?.results) {
    return <p className="text-sm text-text-muted">Results unavailable.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-border-primary text-left font-mono text-[10px] uppercase tracking-widest text-text-muted">
          <tr>
            <th className="py-2 pr-4">Pos</th>
            <th className="py-2 pr-4">Driver</th>
            <th className="py-2 pr-4">Team</th>
            <th className="py-2 pr-4">Time</th>
            <th className="py-2">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary/60">
          {data.results.slice(0, limit).map((result) => (
            <tr
              key={`${result.position ?? "classified"}-${result.driver.driver_code ?? result.driver.full_name}`}
            >
              <td className="py-2 pr-4 font-mono text-text-secondary">
                P{result.position ?? "-"}
              </td>
              <td className="py-2 pr-4 text-text-primary">
                {result.driver.full_name}
                {result.fastest_lap && (
                  <span className="ml-1 text-purple-300">FL</span>
                )}
              </td>
              <td className="py-2 pr-4 text-text-tertiary">
                {result.team.name}
              </td>
              <td className="py-2 pr-4 font-mono text-text-tertiary">
                {result.time_seconds != null
                  ? result.position === 1
                    ? `${result.time_seconds.toFixed(3)}s`
                    : `+${result.time_seconds.toFixed(3)}s`
                  : result.status}
              </td>
              <td className="py-2 font-mono text-text-secondary">
                {result.points || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QualifyingProgressionEmbed({
  season,
  round,
  isSprint,
}: {
  season: number;
  round: number;
  isSprint: boolean;
}) {
  const { data, isLoading } = useQuery<SessionResultsResponse | null>({
    queryKey: ["discussion-qualifying-progression", season, round, isSprint],
    queryFn: async () => {
      const endpoint = isSprint
        ? `/api/results/${season}/${round}/sprint-qualifying`
        : `/api/results/${season}/${round}/qualifying`;
      const res = await fetch(apiUrl(endpoint), {
        cache: "no-store",
        headers: apiHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <p className="text-sm text-text-muted">Loading qualifying chart...</p>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-text-muted">Qualifying data unavailable.</p>
    );
  }

  return <QualifyingProgressionChart qualifyingData={data} />;
}

function CrossSessionComparisonEmbed({
  season,
  round,
}: {
  season: number;
  round: number;
}) {
  const fetchSession = async (practiceSession: 1 | 2 | 3) => {
    const res = await fetch(
      apiUrl(`/api/results/${season}/${round}/practice/${practiceSession}`),
      { cache: "no-store", headers: apiHeaders() },
    );
    if (!res.ok) return null;
    return res.json() as Promise<SessionResultsResponse>;
  };

  const { data: fp1Data } = useQuery({
    queryKey: ["discussion-cross-session", season, round, 1],
    queryFn: () => fetchSession(1),
  });
  const { data: fp2Data } = useQuery({
    queryKey: ["discussion-cross-session", season, round, 2],
    queryFn: () => fetchSession(2),
  });
  const { data: fp3Data } = useQuery({
    queryKey: ["discussion-cross-session", season, round, 3],
    queryFn: () => fetchSession(3),
  });

  return (
    <CrossSessionComparison
      fp1Data={fp1Data}
      fp2Data={fp2Data}
      fp3Data={fp3Data}
    />
  );
}

export function DiscussionEmbed({
  kind,
  attrs,
}: {
  kind: "lapwise-chart" | "lapwise-table";
  attrs: DiscussionEmbedAttrs;
}) {
  const season = toNumber(attrs.season);
  const round = toNumber(attrs.round);
  const type = attrs.type;
  const isSprint = toBoolean(attrs.isSprint);
  const practiceSession = toNumber(attrs.practiceSession);
  const embedDefinition = getDiscussionEmbed(type);

  if (!season || !type || (embedDefinition?.needsRound !== false && !round)) {
    return (
      <EmbedError message="This Lapwise embed needs type, season, and any required round parameters." />
    );
  }

  if (kind === "lapwise-table") {
    if (
      ![
        "race-results",
        "qualifying-results",
        "sprint-results",
        "sprint-qualifying-results",
      ].includes(type)
    ) {
      return <EmbedError message={`Unsupported Lapwise table: ${type}`} />;
    }

    return (
      <EmbedShell title={attrs.title || embedDefinition?.label || "Results"}>
        <RaceResultsEmbed
          season={season}
          round={round as number}
          type={type}
          limit={toNumber(attrs.limit) || 10}
        />
      </EmbedShell>
    );
  }

  const title = attrs.title;
  const drivers = parseDrivers(attrs.drivers);
  const entities = parseDrivers(attrs.entities);
  const fp =
    practiceSession === 1 || practiceSession === 2 || practiceSession === 3
      ? practiceSession
      : 1;
  const initialViewMode =
    attrs.view === "gap"
      ? "gapToLeader"
      : attrs.view === "lapTime"
        ? "lapTime"
        : "position";

  switch (type) {
    case "lap-time-by-lap":
    case "position-battle":
      return (
        <EmbedShell title={title}>
          <LapTimeByLapGraph
            season={season}
            round={round as number}
            isSprint={isSprint}
            practiceSession={practiceSession === 1 || practiceSession === 2 || practiceSession === 3 ? practiceSession : undefined}
            initialViewMode={initialViewMode}
            initialDrivers={drivers}
            embedded
          />
        </EmbedShell>
      );
    case "pit-stop-delta":
      return (
        <EmbedShell title={title}>
          <PitStopDeltaChart
            season={season}
            round={round as number}
            isSprint={isSprint}
          />
        </EmbedShell>
      );
    case "tyre-stints":
      return (
        <EmbedShell title={title}>
          <TyreStintChart
            season={season}
            round={round as number}
            isSprint={isSprint}
            initialDrivers={drivers}
          />
        </EmbedShell>
      );
    case "tyre-degradation":
      return (
        <EmbedShell title={title}>
          <TyreDegradationChart
            season={season}
            round={round as number}
            isSprint={isSprint}
            initialDrivers={drivers}
          />
        </EmbedShell>
      );
    case "speed-trap":
      return (
        <EmbedShell title={title}>
          <SpeedTrapChart season={season} round={round as number} isSprint={isSprint} />
        </EmbedShell>
      );
    case "race-pace-evolution":
      return (
        <EmbedShell title={title}>
          <RaceTrackEvolutionChart season={season} round={round as number} />
        </EmbedShell>
      );
    case "lap-time-distribution":
      return (
        <EmbedShell title={title}>
          <LapTimeDistributionChart season={season} round={round as number} />
        </EmbedShell>
      );
    case "weather":
      return (
        <EmbedShell title={title}>
          <WeatherChart season={season} round={round as number} />
        </EmbedShell>
      );
    case "fastest-lap-timeline":
      return (
        <EmbedShell title={title}>
          <FastestLapTimeline
            season={season}
            round={round as number}
            isSprint={isSprint}
          />
        </EmbedShell>
      );
    case "qualifying-progression":
      return (
        <EmbedShell title={title}>
          <QualifyingProgressionEmbed
            season={season}
            round={round as number}
            isSprint={isSprint}
          />
        </EmbedShell>
      );
    case "qualifying-sector-heatmap":
      return (
        <EmbedShell title={title}>
          <QualifyingSectorHeatmap season={season} round={round as number} />
        </EmbedShell>
      );
    case "qualifying-sector-comparison":
      return (
        <EmbedShell title={title}>
          <QualifyingSectorComparison season={season} round={round as number} />
        </EmbedShell>
      );
    case "long-run-pace":
      return (
        <EmbedShell title={title}>
          <LongRunPaceChart
            season={season}
            round={round as number}
            practiceSession={fp}
            initialDrivers={drivers}
          />
        </EmbedShell>
      );
    case "track-evolution":
      return (
        <EmbedShell title={title}>
          <TrackEvolutionChart
            season={season}
            round={round as number}
            practiceSession={fp}
            initialDrivers={drivers}
          />
        </EmbedShell>
      );
    case "tyre-programme":
      return (
        <EmbedShell title={title}>
          <TyreProgrammeChart
            season={season}
            round={round as number}
            practiceSession={fp}
            initialDrivers={drivers}
          />
        </EmbedShell>
      );
    case "practice-sector-heatmap":
      return (
        <EmbedShell title={title}>
          <PracticeSectorHeatmap
            season={season}
            round={round as number}
            practiceSession={fp}
            initialDrivers={drivers}
          />
        </EmbedShell>
      );
    case "cross-session-comparison":
      return (
        <EmbedShell title={title}>
          <CrossSessionComparisonEmbed season={season} round={round as number} />
        </EmbedShell>
      );
    case "points-by-round":
      return (
        <EmbedShell title={title}>
          <PointsByRoundGraph
            season={String(season)}
            pointsType={attrs.pointsType === "qualifying" ? "qualifying" : "race"}
            initialMode={attrs.mode === "constructors" ? "constructors" : "drivers"}
            initialEntities={entities}
          />
        </EmbedShell>
      );
    case "teammate-head-to-head":
      return (
        <EmbedShell title={title}>
          <TeammateHeadToHead
            season={String(season)}
            mode={attrs.mode === "qualifying" ? "qualifying" : "race"}
            initialTeams={entities}
          />
        </EmbedShell>
      );
    default:
      return <EmbedError message={`Unsupported Lapwise chart: ${type}`} />;
  }
}
