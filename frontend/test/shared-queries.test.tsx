// @vitest-environment jsdom
import { useQuery } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import FastestLapTimeline from "@/components/FastestLapTimeline";
import PitStopDeltaChart from "@/components/PitStopDeltaChart";
import RaceTrackEvolutionChart from "@/components/RaceTrackEvolutionChart";
import {
  circuitsQuery,
  constructorsQuery,
  driversQuery,
} from "@/lib/queries/archive";
import { seasonsQuery } from "@/lib/queries/seasons";
import * as fixtures from "./fixtures";
import {
  flushRequests,
  installFetchRecorder,
  renderWithQueryClient,
} from "./requestRecorder";

const SEASON = 2026;
const ROUND = 11;
const LAP_TIMES_PATH = `/api/results/${SEASON}/${ROUND}/lap-times`;

const lapTimes = {
  season: SEASON,
  round: ROUND,
  event_name: "Test Grand Prix",
  session_type: "race",
  total_laps: 2,
  drivers: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("race lap-time consumers", () => {
  it("issues one request when several race charts mount together", async () => {
    const recorder = installFetchRecorder({ [LAP_TIMES_PATH]: lapTimes });

    renderWithQueryClient(
      <>
        <FastestLapTimeline season={SEASON} round={ROUND} />
        <PitStopDeltaChart season={SEASON} round={ROUND} />
        <RaceTrackEvolutionChart season={SEASON} round={ROUND} />
      </>,
    );
    await flushRequests();

    expect(recorder.countMatching(LAP_TIMES_PATH)).toBe(1);
  });
});

describe("archive list consumers", () => {
  function ArchiveConsumers() {
    useQuery(driversQuery());
    useQuery(driversQuery());
    useQuery(constructorsQuery());
    useQuery(circuitsQuery());
    useQuery(seasonsQuery());
    useQuery(seasonsQuery());
    return null;
  }

  it("shares one request per list across consumers", async () => {
    const recorder = installFetchRecorder({
      "/api/drivers/": { drivers: [], total: 0 },
      "/api/constructors/": { constructors: [], total: 0 },
      "/api/circuits/": fixtures.circuits,
      "/api/results/seasons": [SEASON],
    });

    renderWithQueryClient(<ArchiveConsumers />);
    await flushRequests();

    expect(recorder.countMatching("/api/drivers/")).toBe(1);
    expect(recorder.countMatching("/api/constructors/")).toBe(1);
    expect(recorder.countMatching("/api/circuits/")).toBe(1);
    expect(recorder.countMatching("/api/results/seasons")).toBe(1);
  });
});
