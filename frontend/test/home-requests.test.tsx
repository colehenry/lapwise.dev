// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import AIAnalystPreview from "@/components/home/AIAnalystPreview";
import LiveReplayPreview from "@/components/home/LiveReplayPreview";
import SeasonRoundSelector from "@/components/home/SeasonRoundSelector";
import TopRightLatestRace from "@/components/home/TopRightLatestRace";
import NextRaceBanner from "@/components/NextRaceBanner";
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

const ROUTES = {
  "/api/replay/seasons": fixtures.replaySeasons,
  "/api/replay/available": fixtures.availableReplays,
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
      `/api/replay/${fixtures.FIXTURE_SEASON}/${fixtures.FIXTURE_ROUND}`,
      `/api/replay/available?season=${fixtures.FIXTURE_SEASON}`,
      "/api/replay/seasons",
      `/api/results/${fixtures.FIXTURE_SEASON}`,
      `/api/results/${fixtures.FIXTURE_SEASON}/standings`,
      "/api/results/latest",
      "/api/results/seasons",
    ]);
  });

  it("requests the full replay blob on mount", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<HomeClientSections />);
    await flushRequests();

    expect(
      recorder.countMatching(
        `/api/replay/${fixtures.FIXTURE_SEASON}/${fixtures.FIXTURE_ROUND}`,
      ),
    ).toBe(1);
  });
});
