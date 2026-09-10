"use client";

import { useQuery } from "@tanstack/react-query";
import DeferredSection from "@/components/ui/DeferredSection";
import { useCompactViewport, useHomeConsole } from "@/hooks/useHomeConsole";
import { useRaceClock } from "@/hooks/useRaceClock";
import type { ClutchContext } from "@/lib/homeClutchScript";
import {
  EMPTY_ENTITY_COLORS,
  seasonStandingsQuery,
  selectEntityColors,
} from "@/lib/queries/standings";
import ClutchBand from "./ClutchBand";
import ConsoleFrame from "./ConsoleFrame";
import ConsolePanel, { PanelFailure } from "./ConsolePanel";
import DailyGridCard from "./DailyGridCard";
import EntryTiles from "./EntryTiles";
import HomeRunningOrder from "./HomeRunningOrder";
import HomeTicker from "./HomeTicker";
import LeaderPanel from "./LeaderPanel";
import NextRaceCard from "./NextRaceCard";
import PodiumCard from "./PodiumCard";
import RaceFeed from "./RaceFeed";
import RaceMap from "./RaceMap";
import RecentRaces from "./RecentRaces";
import TrackOutline from "./TrackOutline";

/** The reduced map is animation only, at a fixed height. */
const COMPACT_MAP_HEIGHT = 320;

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

  const clutchContext: ClutchContext = {
    season: data.season,
    standings: standings.data,
    latest: data.latest,
    latestClassification: data.classification.data,
  };

  const track = data.track?.track;
  const hasTelemetry = data.replay != null && data.replayState === "ready";

  const gridCard = (
    <DailyGridCard
      summary={data.daily.data ?? undefined}
      state={data.daily.state}
      className={compact ? "" : "home-console__grid"}
    />
  );

  const podium = (
    <PodiumCard
      latest={data.latest}
      state={data.latestState}
      classification={data.classification.data}
      fastestLap={data.replay?.fastest_lap}
      className={compact ? "" : "home-console__podium"}
    />
  );

  const map = (
    <ConsolePanel
      bare
      className={compact ? "" : "home-console__map"}
      bodyClassName="p-px"
    >
      {data.replayState === "error" ? (
        <PanelFailure
          message="The replay could not be loaded."
          onRetry={data.retryReplay}
        />
      ) : hasTelemetry && data.replay && track ? (
        <RaceMap
          replay={data.replay}
          polyline={track.polyline}
          rotationDegrees={track.rotation_deg}
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

      {compact ? (
        <div className="page-frame flex flex-col gap-3 py-3">
          {gridCard}
          <div style={{ height: COMPACT_MAP_HEIGHT }}>{map}</div>
          {podium}
        </div>
      ) : (
        <ConsoleFrame viewportRef={clock.viewportRef} quiet={!hasTelemetry}>
          {gridCard}
          {podium}
          {map}
          {hasTelemetry && data.replay && (
            <>
              <LeaderPanel
                replay={data.replay}
                clock={clock}
                className="home-console__lead"
              />
              <HomeRunningOrder
                cars={data.replay.cars}
                clock={clock}
                className="home-console__order"
              />
              <RaceFeed
                replay={data.replay}
                clock={clock}
                className="home-console__feed"
              />
            </>
          )}
        </ConsoleFrame>
      )}

      <DeferredSection minHeight={420}>
        <ClutchBand
          context={clutchContext}
          colors={entityColors}
          animate={!clock.reducedMotion}
        />
      </DeferredSection>

      <DeferredSection minHeight={520}>
        <div className="page-frame grid gap-3 py-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <RecentRaces season={data.season} />
            <NextRaceCard />
          </div>
          <EntryTiles
            season={data.season}
            round={data.latest?.round ?? null}
            circuitName={data.latest?.circuit_name ?? null}
          />
        </div>
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
  const round = data.latest?.round;
  const loading =
    data.replayState === "loading" || data.latestState === "loading";

  return (
    <TrackOutline
      polyline={track?.polyline}
      rotationDegrees={track?.rotation_deg}
      circuitName={circuitName ?? "Circuit"}
      message={
        loading
          ? "Loading the lap record for the most recent round."
          : `Lap data for round ${round ?? "—"} has not published yet. The result is already in.`
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
