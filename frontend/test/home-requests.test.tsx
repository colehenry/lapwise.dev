// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import AIAnalystPreview from "@/components/home/AIAnalystPreview";
import LiveReplayPreview from "@/components/home/LiveReplayPreview";
import NextRaceBanner from "@/components/home/NextRaceBanner";
import SeasonRoundSelector from "@/components/home/SeasonRoundSelector";
import TopRightLatestRace from "@/components/home/TopRightLatestRace";
import * as fixtures from "./fixtures";
import {
  flushRequests,
  installFetchRecorder,
  msgpackBody,
  renderWithQueryClient,
} from "./requestRecorder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/replay/components/TrackCanvas", () => ({
  default: () => null,
}));

const REPLAY_BLOB_PATH = `/api/replay/${fixtures.FIXTURE_SEASON}/${fixtures.FIXTURE_ROUND}`;
const REPLAY_PREVIEW_PATH = "/api/replay/preview/latest";

const ROUTES = {
  [REPLAY_PREVIEW_PATH]: msgpackBody(fixtures.replayPreviewArtifact),
  [`/api/replay/${fixtures.FIXTURE_SEASON}/${fixtures.FIXTURE_ROUND}`]:
    msgpackBody(fixtures.replayData),
  [`/api/results/${fixtures.FIXTURE_SEASON}/standings`]: fixtures.standings,
  "/api/results/seasons": [fixtures.FIXTURE_SEASON],
  "/api/results/latest": fixtures.latestRound,
  [`/api/results/${fixtures.FIXTURE_SEASON}`]: fixtures.seasonRounds,
  "/api/events/upcoming": fixtures.upcomingEvents,
  "/api/circuits/": fixtures.circuits,
};

function HomeClientSections() {
  return (
    <>
      <TopRightLatestRace />
      <SeasonRoundSelector />
      <LiveReplayPreview />
      <AIAnalystPreview />
      <NextRaceBanner />
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("home initial request inventory", () => {
  it("records the endpoints home requests before any interaction", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<HomeClientSections />);
    await flushRequests();

    const paths = [...new Set(recorder.paths())].sort();
    expect(paths).toEqual([
      "/api/circuits/",
      "/api/events/upcoming?limit=10",
      REPLAY_PREVIEW_PATH,
      `/api/results/${fixtures.FIXTURE_SEASON}`,
      `/api/results/${fixtures.FIXTURE_SEASON}/standings`,
      "/api/results/latest",
      "/api/results/seasons",
    ]);
  });

  it("never requests the full replay blob", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<HomeClientSections />);
    await flushRequests();

    expect(recorder.countMatching(REPLAY_BLOB_PATH)).toBe(0);
  });

  it("resolves the autoplaying preview in a single request", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<HomeClientSections />);
    await flushRequests();

    expect(recorder.countMatching(REPLAY_PREVIEW_PATH)).toBe(1);
    // The artifact carries the latest race, so home does not chain
    // seasons -> available to find it.
    expect(recorder.countMatching("/api/replay/seasons")).toBe(0);
    expect(recorder.countMatching("/api/replay/available")).toBe(0);
  });

  it("requests current standings once for the color consumers", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<HomeClientSections />);
    await flushRequests();

    expect(
      recorder.countMatching(
        `/api/results/${fixtures.FIXTURE_SEASON}/standings`,
      ),
    ).toBe(1);
  });
});
