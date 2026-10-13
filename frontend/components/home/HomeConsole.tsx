"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import DeferredSection from "@/components/ui/DeferredSection";
import { useCompactViewport, useHomeConsole } from "@/hooks/useHomeConsole";
import { useRaceClock } from "@/hooks/useRaceClock";
import type { HomeContext } from "@/lib/clutch/scripts/home";
import {
  EMPTY_ENTITY_COLORS,
  seasonStandingsQuery,
  selectEntityColors,
} from "@/lib/queries/standings";
import ClutchAsk from "./ClutchAsk";
import ConsoleFrame from "./ConsoleFrame";
import ConsolePanel, { PanelFailure } from "./ConsolePanel";
import DailyGamesCard from "./DailyGamesCard";
import { HomeClutchPlaceholder } from "./HomeClutchFrame";
import HomeTailSkeleton from "./HomeTailSkeleton";
import HomeTicker from "./HomeTicker";
import RaceMap from "./RaceMap";
import RacePanel from "./RacePanel";
import TrackOutline from "./TrackOutline";

// The band mounts on scroll; its scripts arrive with it rather than the map.
const ClutchBand = dynamic(() => import("./ClutchBand"), {
  loading: () => <HomeClutchPlaceholder />,
});
const HomeTail = dynamic(() => import("./HomeTail"), {
  loading: HomeTailSkeleton,
});

export default function HomeConsole() {
  const data = useHomeConsole();
  const compact = useCompactViewport();
  const clock = useRaceClock(data.replay);

  const { data: colors } = useQuery({
    ...seasonStandingsQuery(data.season ?? 0),
    enabled: data.season !== null,
    select: selectEntityColors,
  });
  const entityColors = colors ?? EMPTY_ENTITY_COLORS;

  const standings = useQuery({
    ...seasonStandingsQuery(data.season ?? 0),
    enabled: data.season !== null,
  });

  /* A fresh object here re-resolves the script on every render, which the
     band's typewriter reads as a new answer. */
  const clutchContext: HomeContext = useMemo(
    () => ({
      season: data.season,
      standings: standings.data,
      latest: data.latest,
      latestClassification: data.classification.data,
      roundsRun: data.latest?.round,
    }),
    [data.season, standings.data, data.latest, data.classification.data],
  );

  const track = data.track?.track;
  const hasTelemetry = data.replay != null && data.replayState === "ready";

  const gridCard = (
    <DailyGamesCard
      summary={data.dailyGames.data ?? undefined}
      state={data.dailyGames.state}
      className="home-console__grid"
    />
  );

  const map = (
    <ConsolePanel bare className="home-console__map" bodyClassName="p-px">
      {data.replayState === "error" ? (
        <PanelFailure
          message="The replay could not be loaded."
          onRetry={data.retryReplay}
        />
      ) : hasTelemetry && data.replay && track ? (
        <RaceMap
          replay={data.replay}
          polyline={track.polyline}
          round={data.replayRound ?? 0}
          newerRound={data.walkedBack ? (data.latest?.round ?? null) : null}
          season={data.season}
          clock={clock}
          reduced={compact}
        />
      ) : (
        <TrackPlaceholder data={data} track={track} />
      )}
    </ConsolePanel>
  );

  return (
    <div className="bg-surface-page">
      <HomeTicker
        headlines={data.headlines.data?.headlines}
        colors={entityColors}
        loading={data.headlines.state === "loading"}
      />

      <ConsoleFrame viewportRef={clock.viewportRef}>
        {gridCard}
        {map}
        <RacePanel
          season={data.season}
          round={data.replayRound}
          clock={clock}
          state={data.replayState}
          enabled={!compact}
          onRetry={data.retryReplay}
          className="home-console__race"
        />
        <ClutchAsk replay={data.replay} className="home-console__clutch" />
      </ConsoleFrame>

      <DeferredSection minHeight={0} placeholder={<HomeClutchPlaceholder />}>
        <ClutchBand
          context={clutchContext}
          colors={entityColors}
          animate={!clock.reducedMotion}
          loading={
            data.latestState === "loading" ||
            (data.season !== null && standings.isPending)
          }
        />
      </DeferredSection>

      <DeferredSection minHeight={0} placeholder={<HomeTailSkeleton />}>
        <HomeTail
          season={data.season}
          round={data.latest?.round ?? null}
          circuitName={data.latest?.circuit_name ?? null}
        />
      </DeferredSection>
    </div>
  );
}

function TrackPlaceholder({
  data,
  track,
}: {
  data: ReturnType<typeof useHomeConsole>;
  track: { polyline: number[][]; rotation_deg: number | null } | undefined;
}) {
  const circuitName = data.replay?.circuit_name ?? data.latest?.circuit_name;
  const round = data.replayRound ?? data.latest?.round;
  const loading =
    data.replayState === "loading" || data.latestState === "loading";

  return (
    <TrackOutline
      polyline={track?.polyline}
      circuitName={circuitName ?? "Circuit"}
      message={
        loading
          ? "Loading the lap record for the most recent round."
          : data.replay
            ? "The track outline is not available for this round."
            : data.latest
              ? `Lap data for round ${round} has not published yet. The result is already in.`
              : "No race results have published yet."
      }
      href={
        !loading && data.season && round
          ? `/results/${data.season}/${round}`
          : undefined
      }
      linkLabel={loading ? undefined : "See the result"}
    />
  );
}
