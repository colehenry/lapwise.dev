"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import {
  useLatestRound,
  useReplayableRace,
  useRoundResults,
  useSeasonRounds,
  useStandings,
  useTrackGeometry,
  useUpcoming,
} from "@/hooks/useHomeData";
import { useRaceClock } from "@/hooks/useRaceClock";
import { getDriverHeadshotUrl } from "@/lib/entityImageOverrides";
import type { RoundSummary } from "@/lib/types";
import AskDemo from "./AskDemo";
import CapabilityRail from "./CapabilityRail";
import ChannelStrip from "./ChannelStrip";
import HeroTrack from "./HeroTrack";
import LatestResult from "./LatestResult";
import RunningOrder from "./RunningOrder";
import { toGlobeRounds } from "./SeasonGlobe";
import SeasonSection from "./SeasonSection";

/**
 * The console home page.
 *
 * One race clock drives the track, the order sheet, the channels and the rail,
 * so every panel is always showing the same instant. Small payloads render
 * immediately; the lap-by-lap telemetry that powers the clock is fetched after
 * paint, because it is by far the heaviest thing on the page.
 */
export default function HomeConsole() {
  const { data: latest } = useLatestRound();
  const season = latest ? new Date(latest.date).getFullYear() : undefined;

  const { data: standings } = useStandings(season);
  const { data: seasonRounds } = useSeasonRounds(season);
  const { data: upcoming } = useUpcoming();
  const { data: latestResults } = useRoundResults(season, latest?.round);
  const { data: replayable, isLoading: replayLoading } = useReplayableRace(
    season,
    latest?.round,
  );

  const race = replayable?.lapTimes;
  const raceRound = replayable?.round;

  const raceCircuitId = useMemo(() => {
    if (!seasonRounds?.rounds || !raceRound) return undefined;
    return (
      seasonRounds.rounds.find((r: RoundSummary) => r.round === raceRound)
        ?.circuit_id ?? undefined
    );
  }, [seasonRounds, raceRound]);

  const { data: raceTrack } = useTrackGeometry(raceCircuitId);
  const { data: latestTrack } = useTrackGeometry(latest?.circuit_id);

  const controller = useRaceClock(race);

  // Lap times carry no images, so headshots come from standings and the
  // override table the rest of the site already uses.
  const headshotFor = useCallback(
    (code: string, name: string) => {
      const match = standings?.drivers.find((d) => d.driver_code === code);
      return getDriverHeadshotUrl({
        driver_code: code,
        full_name: name,
        headshot_url: match?.headshot_url ?? null,
      });
    },
    [standings],
  );

  const globeRounds = useMemo(
    () => (seasonRounds?.rounds ? toGlobeRounds(seasonRounds.rounds) : []),
    [seasonRounds],
  );

  const nextRace = useMemo(() => {
    if (!upcoming?.length) return undefined;
    const now = Date.now();
    return (
      upcoming.find((e) => new Date(e.event_date).getTime() >= now) ??
      upcoming[0]
    );
  }, [upcoming]);

  const eventName = race?.event_name ?? latest?.event_name ?? "";
  const circuitName = raceTrack?.circuit_name ?? latest?.circuit_name ?? "";
  const telemetryBehind =
    Boolean(latest && raceRound) && latest?.round !== raceRound;

  return (
    <div className="bg-bg-primary">
      <section className="grid gap-3 p-3 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <CapabilityRail
            clock={controller.clock}
            state={controller.state}
            track={raceTrack?.track}
            standings={standings?.drivers ?? []}
            eventName={eventName}
            seasons={77}
            firstSeason={1950}
            lastSeason={season ?? 2026}
          />
          {telemetryBehind && (
            <p className="rounded-sm border border-border-primary bg-bg-tertiary px-3 py-2.5 font-mono text-[10px] leading-relaxed text-text-muted">
              <span className="text-text-secondary">
                Replaying round {raceRound}
              </span>{" "}
              — the newest race with telemetry. Round {latest?.round} (
              {latest?.event_name}) has run; its lap data is still ingesting.{" "}
              <Link href="/results" className="text-purple-400 hover:underline">
                Result →
              </Link>
            </p>
          )}
        </div>

        {/* Track and channels stack on the left; the order sheet spans both so
            the three panels read as one instrument. */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-3">
            <div className="min-h-[24rem]">
              <HeroTrack
                track={raceTrack?.track}
                controller={controller}
                eventName={eventName}
                circuitName={circuitName}
                round={raceRound ?? latest?.round ?? 0}
                headshotFor={headshotFor}
              />
            </div>
            <ChannelStrip state={controller.state} track={raceTrack?.track} />
          </div>

          <div className="grid">
            <RunningOrder
              state={controller.state}
              rows={14}
              headshotFor={headshotFor}
            />
          </div>

          <div className="lg:col-span-2">
            <LatestResult
              latest={latest}
              results={latestResults}
              polyline={latestTrack?.track.polyline}
              rotation={latestTrack?.track.rotation_deg ?? 0}
            />
          </div>
        </div>
      </section>

      {globeRounds.length > 0 && season && (
        <SeasonSection rounds={globeRounds} season={season} next={nextRace} />
      )}

      <section className="border-t border-border-primary px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-purple-400">
            Ask
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
            Ask it anything about the race.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-text-secondary">
            Clutch reads the database directly. Every answer below is computed
            from the same lap records the console above is running on.
          </p>
          <div className="mt-8">
            <AskDemo clock={controller.clock} eventName={eventName} />
          </div>
        </div>
      </section>

      {replayLoading && !race && (
        <output className="sr-only">Loading race telemetry</output>
      )}
    </div>
  );
}
