// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import HomeConsole from "@/components/home/HomeConsole";
import * as fixtures from "./fixtures";
import {
  flushRequests,
  installFetchRecorder,
  renderWithQueryClient,
} from "./requestRecorder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const SEASON = fixtures.FIXTURE_SEASON;
const ROUND = fixtures.FIXTURE_ROUND;
const CONSOLE_PATH = `/api/replay/console/${SEASON}/${ROUND}`;
const REPLAY_BLOB_PATH = `/api/replay/${SEASON}/${ROUND}`;

const ROUTES: Record<string, unknown> = {
  "/api/results/latest": fixtures.latestRound,
  [CONSOLE_PATH]: fixtures.consoleReplay,
  "/api/replay/track/16": {
    season: SEASON,
    round: ROUND,
    event_name: "Fixture Grand Prix",
    circuit_id: 16,
    circuit_name: "Fixture Park",
    track: {
      polyline: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      rotation_deg: 0,
      corners: [],
      drs_zones: [],
    },
  },
  [`/api/results/${SEASON}/${ROUND}`]: { session: {}, results: [] },
  [`/api/results/${SEASON}/standings`]: fixtures.standings,
  "/api/daily/summary": fixtures.dailySummary,
  [`/api/headlines?season=${SEASON}`]: fixtures.headlines,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("home console request inventory", () => {
  it("records the endpoints the console requests before any interaction", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<HomeConsole />);
    await flushRequests();

    expect([...new Set(recorder.paths())].sort()).toEqual([
      "/api/daily/summary",
      `/api/headlines?season=${SEASON}`,
      CONSOLE_PATH,
      `${CONSOLE_PATH}/telemetry/VER`,
      "/api/replay/track/16",
      `/api/results/${SEASON}/${ROUND}`,
      `/api/results/${SEASON}/standings`,
      "/api/results/latest",
    ]);
  });

  it("never requests the full replay blob", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<HomeConsole />);
    await flushRequests();

    expect(recorder.countMatching(REPLAY_BLOB_PATH)).toBe(0);
  });

  it("requests standings once for every colour consumer on the page", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<HomeConsole />);
    await flushRequests();

    expect(recorder.countMatching(`/api/results/${SEASON}/standings`)).toBe(1);
  });

  it("fetches telemetry for the leader alone, not for the whole field", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<HomeConsole />);
    await flushRequests();

    const slices = recorder
      .paths()
      .filter((path) => path.includes("/telemetry/"));
    expect(slices).toEqual([`${CONSOLE_PATH}/telemetry/VER`]);
  });

  it("leaves the tail's requests until the reader heads toward it", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<HomeConsole />);
    await flushRequests();

    expect(recorder.countMatching("/api/events/upcoming")).toBe(0);
    expect(recorder.countMatching("/api/archive/counts")).toBe(0);
    expect(recorder.paths()).not.toContain(`/api/results/${SEASON}`);
    expect(recorder.paths()).not.toContain(
      `/api/results/${SEASON}/points-progression`,
    );
  });
});

describe("the walk-back", () => {
  const LATEST = 4;

  function walkBackRoutes(): Record<string, unknown> {
    return {
      ...ROUTES,
      "/api/results/latest": { ...fixtures.latestRound, round: LATEST },
      [`/api/replay/console/${SEASON}/${LATEST}`]: null,
      [`/api/replay/console/${SEASON}/${LATEST - 1}`]: null,
      [`/api/replay/console/${SEASON}/${LATEST - 2}`]: fixtures.consoleReplay,
      [`/api/results/${SEASON}/${LATEST}`]: { session: {}, results: [] },
    };
  }

  it("walks back past rounds with no lap data and replays the first that answers", async () => {
    const recorder = installFetchRecorder(walkBackRoutes());
    const { container } = renderWithQueryClient(<HomeConsole />);
    await flushRequests(20);

    expect(recorder.paths()).toContain(
      `/api/replay/console/${SEASON}/${LATEST}`,
    );
    expect(recorder.paths()).toContain(
      `/api/replay/console/${SEASON}/${LATEST - 2}`,
    );
    expect(container.textContent).toContain(`Round ${LATEST - 2}`);
  });

  it("says on screen which newer round is still missing its lap data", async () => {
    installFetchRecorder(walkBackRoutes());
    const { container } = renderWithQueryClient(<HomeConsole />);
    await flushRequests(20);

    expect(container.textContent).toContain(
      `Round ${LATEST} has no lap data yet`,
    );
  });

  it("stops after four rounds rather than walking the whole season", async () => {
    const { [CONSOLE_PATH]: _unused, ...rest } = ROUTES;
    const recorder = installFetchRecorder({
      ...rest,
      "/api/results/latest": { ...fixtures.latestRound, round: 20 },
      "/api/replay/console/": null,
    });
    renderWithQueryClient(<HomeConsole />);
    await flushRequests(20);

    const attempts = recorder
      .paths()
      .filter((path) => path.startsWith("/api/replay/console/"));
    expect(attempts).toHaveLength(5);
  });
});
