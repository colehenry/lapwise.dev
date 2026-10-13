// @vitest-environment jsdom
import { fireEvent, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomeConsole from "@/components/home/HomeConsole";
import { consoleKeys } from "@/lib/queries/consoleReplay";
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

const PLAYER_ID = "00000000-0000-4000-8000-000000000001";

vi.mock("@/hooks/useDailyGamePlayer", () => ({
  useDailyGamePlayer: () => PLAYER_ID,
}));

const SEASON = fixtures.FIXTURE_SEASON;
const ROUND = fixtures.FIXTURE_ROUND;
const CONSOLE_PATH = `/api/replay/console/${SEASON}/${ROUND}`;
const REFERENCE = { season: SEASON, round: ROUND, revision: "1-4-4" };
const AVAILABILITY_PATH = "/api/replay/console/availability";
const AVAILABILITY = {
  season: SEASON,
  latest: fixtures.latestRound,
  replay: REFERENCE,
};
const CONSOLE_REQUEST = `${CONSOLE_PATH}/v3?revision=${REFERENCE.revision}`;
const REPLAY_BLOB_PATH = `/api/replay/${SEASON}/${ROUND}`;

const ROUTES: Record<string, unknown> = {
  [AVAILABILITY_PATH]: AVAILABILITY,
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
  [`/api/games/summary?anon_id=${PLAYER_ID}`]: {
    games: [
      {
        game: "grid",
        name: "Daily Grid",
        href: "/daily",
        state: "not_started",
        progress: 0,
        total: 9,
        puzzle_number: 1,
        published_on: "2026-09-10",
      },
      {
        game: "guess",
        name: "Guess the Driver",
        href: "/guess",
        state: "not_started",
        progress: 0,
        total: 10,
        puzzle_number: 1,
        published_on: "2026-09-10",
      },
    ],
  },
  [`/api/headlines?season=${SEASON}`]: fixtures.headlines,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("home console request inventory", () => {
  it("reserves the same panel nodes before discovery, replay and telemetry arrive", async () => {
    const telemetryPath = `${CONSOLE_PATH}/telemetry/VER`;
    installFetchRecorder({
      ...ROUTES,
      [telemetryPath]: msgpackBody({
        v: 1,
        code: "VER",
        fps: 10,
        samples: 2,
        speed: new Uint8Array([10, 0, 20, 0]),
        gear: new Uint8Array([1, 2]),
        throttle: new Uint8Array([10, 80]),
        brake: new Uint8Array([0, 0]),
        lap_starts: [0],
      }),
    });
    const recordedFetch = globalThis.fetch;
    let releaseDiscovery: () => void = () => {};
    let releaseTelemetry: () => void = () => {};
    const discoveryGate = new Promise<void>((resolve) => {
      releaseDiscovery = resolve;
    });
    const telemetryGate = new Promise<void>((resolve) => {
      releaseTelemetry = resolve;
    });
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(input.toString(), "http://localhost").pathname;
        if (path === AVAILABILITY_PATH) await discoveryGate;
        if (path === telemetryPath) await telemetryGate;
        return recordedFetch(input, init);
      },
    );
    const { container } = renderWithQueryClient(<HomeConsole />);
    const frame = container.querySelector(".home-console");
    const panels = Array.from(frame?.children ?? []);
    const telemetryPanel = container.querySelector(".home-console__race");
    expect(panels).toHaveLength(4);
    expect(telemetryPanel).not.toBeNull();
    expect(
      within(telemetryPanel as HTMLElement).getByRole("img", {
        name: "Loading leader telemetry",
      }),
    ).toBeTruthy();

    releaseDiscovery();
    await flushRequests(12);
    expect(telemetryPanel?.textContent).toContain("Max Verstappen");
    expect(
      within(telemetryPanel as HTMLElement).getByRole("img", {
        name: "Loading leader telemetry",
      }),
    ).toBeTruthy();
    expect(Array.from(frame?.children ?? [])).toEqual(panels);

    releaseTelemetry();
    await flushRequests(12);
    expect(
      within(telemetryPanel as HTMLElement).queryByRole("img", {
        name: "Loading leader telemetry",
      }),
    ).toBeNull();
    expect(container.querySelector(".home-console")).toBe(frame);
    expect(Array.from(frame?.children ?? [])).toEqual(panels);
  });

  it("records the endpoints the console requests before any interaction", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<HomeConsole />);
    await flushRequests();

    expect([...new Set(recorder.paths())].sort()).toEqual([
      `/api/games/summary?anon_id=${PLAYER_ID}`,
      `/api/headlines?season=${SEASON}`,
      `${CONSOLE_PATH}/telemetry/VER`,
      CONSOLE_REQUEST,
      AVAILABILITY_PATH,
      `/api/results/${SEASON}/${ROUND}`,
      `/api/results/${SEASON}/standings`,
    ]);
  });

  it("never requests the full replay blob", async () => {
    const recorder = installFetchRecorder(ROUTES);
    renderWithQueryClient(<HomeConsole />);
    await flushRequests();

    expect(recorder.countMatching(REPLAY_BLOB_PATH)).toBe(0);
  });

  it("draws the map from the console without a dependent geometry request", async () => {
    const recorder = installFetchRecorder(ROUTES);
    const { container } = renderWithQueryClient(<HomeConsole />);
    await flushRequests();

    expect(recorder.countMatching("/api/replay/track/")).toBe(0);
    expect(container.querySelector("svg[aria-label]")).not.toBeNull();
    expect(container.textContent).not.toContain("Loading the lap record");
  });

  it("keeps other panels available when a playable console has no geometry", async () => {
    const recorder = installFetchRecorder({
      ...ROUTES,
      [CONSOLE_PATH]: { ...fixtures.consoleReplay, track: null },
    });
    const { container } = renderWithQueryClient(<HomeConsole />);
    await flushRequests();

    expect(recorder.countMatching("/api/replay/track/")).toBe(0);
    expect(container.textContent).toContain("Daily Grid");
    expect(container.textContent).not.toContain("Loading the lap record");
  });

  it("loads a standalone outline when the backend reports no playable race", async () => {
    const recorder = installFetchRecorder({
      ...ROUTES,
      [AVAILABILITY_PATH]: {
        ...AVAILABILITY,
        latest: { ...fixtures.latestRound, circuit_id: 16 },
        replay: null,
      },
    });
    renderWithQueryClient(<HomeConsole />);
    await flushRequests(20);

    expect(recorder.countMatching("/api/replay/track/16")).toBe(1);
    const paths = recorder.paths();
    const lastReplay = paths
      .map((path) => path.startsWith("/api/replay/console/"))
      .lastIndexOf(true);
    expect(paths.indexOf("/api/replay/track/16")).toBeGreaterThan(lastReplay);
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

describe("backend replay selection and freshness", () => {
  const LATEST = 4;
  const SELECTED = 2;

  function fallbackRoutes(): Record<string, unknown> {
    return {
      ...ROUTES,
      [AVAILABILITY_PATH]: {
        ...AVAILABILITY,
        latest: { ...fixtures.latestRound, round: LATEST },
        replay: { ...REFERENCE, round: SELECTED },
      },
      [`/api/replay/console/${SEASON}/${SELECTED}`]: fixtures.consoleReplay,
      [`/api/results/${SEASON}/${LATEST}`]: { session: {}, results: [] },
    };
  }

  it("fetches only the selected replay and keeps results on the latest round", async () => {
    const recorder = installFetchRecorder(fallbackRoutes());
    const { container } = renderWithQueryClient(<HomeConsole />);
    await flushRequests(20);

    const requests = recorder
      .paths()
      .filter((path) => path.startsWith("/api/replay/console/"));
    expect(requests).toEqual([
      AVAILABILITY_PATH,
      `/api/replay/console/${SEASON}/${SELECTED}/v3?revision=${REFERENCE.revision}`,
      `/api/replay/console/${SEASON}/${SELECTED}/telemetry/VER`,
    ]);
    expect(recorder.paths()).toContain(`/api/results/${SEASON}/${LATEST}`);
    expect(container.textContent).toContain(`R${LATEST} has no lap data yet`);
    expect(recorder.countMatching("/api/replay/track/")).toBe(0);
    expect(
      container.querySelector('svg[aria-label="Fixture Park circuit map"]'),
    ).not.toBeNull();
  });

  it("shows a retryable failure instead of pretending a server outage is missing data", async () => {
    installFetchRecorder({
      ...ROUTES,
      [CONSOLE_PATH]: new Response("unavailable", { status: 503 }),
    });
    const { container } = renderWithQueryClient(<HomeConsole />);
    await flushRequests();
    expect(container.textContent).toContain("The replay could not be loaded.");
    expect(container.textContent).toContain("Retry");
    expect(container.textContent).not.toContain("has not published yet");
  });

  it("recovers a failed replay through the retry button", async () => {
    let failed = true;
    const recorder = installFetchRecorder({
      ...ROUTES,
      [CONSOLE_PATH]: () =>
        failed
          ? new Response("unavailable", { status: 503 })
          : fixtures.consoleReplay,
    });
    const { container } = renderWithQueryClient(<HomeConsole />);
    await flushRequests();
    failed = false;
    fireEvent.click(
      within(
        container.querySelector(".home-console__map") as HTMLElement,
      ).getByRole("button", { name: "Retry" }),
    );
    await flushRequests();
    expect(container.textContent).not.toContain(
      "The replay could not be loaded.",
    );
    expect(recorder.countMatching(`${CONSOLE_PATH}/v3`)).toBe(2);
    expect(
      container.querySelector('svg[aria-label="Fixture Park circuit map"]'),
    ).not.toBeNull();
  });

  it("distinguishes a telemetry outage from absence and lets the reader retry", async () => {
    let failed = true;
    const path = `${CONSOLE_PATH}/telemetry/VER`;
    const recorder = installFetchRecorder({
      ...ROUTES,
      [path]: () =>
        failed
          ? new Response("unavailable", { status: 503 })
          : msgpackBody({
              v: 1,
              code: "VER",
              fps: 10,
              samples: 2,
              speed: new Uint8Array([10, 0, 20, 0]),
              gear: new Uint8Array([1, 2]),
              throttle: new Uint8Array([10, 80]),
              brake: new Uint8Array([0, 0]),
              lap_starts: [0],
            }),
    });
    const { container, getByRole } = renderWithQueryClient(<HomeConsole />);
    await flushRequests();
    expect(container.textContent).toContain("Telemetry could not be loaded.");
    expect(container.textContent).not.toContain(
      "No telemetry ingested for this round",
    );
    failed = false;
    fireEvent.click(getByRole("button", { name: "Retry" }));
    await flushRequests();
    expect(container.textContent).not.toContain(
      "Telemetry could not be loaded.",
    );
    expect(recorder.countMatching(path)).toBe(2);
  });

  it("offers retry when discovery itself fails", async () => {
    installFetchRecorder({
      ...ROUTES,
      [AVAILABILITY_PATH]: new Response("unavailable", { status: 503 }),
    });
    const { container } = renderWithQueryClient(<HomeConsole />);
    await flushRequests();
    expect(container.textContent).toContain("The replay could not be loaded.");
  });

  it("explains an empty archive without claiming results are already in", async () => {
    const recorder = installFetchRecorder({
      ...ROUTES,
      [AVAILABILITY_PATH]: { season: null, latest: null, replay: null },
    });
    const { container } = renderWithQueryClient(<HomeConsole />);
    await flushRequests();
    expect(container.textContent).toContain(
      "No race results have published yet.",
    );
    expect(recorder.paths()).toEqual([
      AVAILABILITY_PATH,
      `/api/games/summary?anon_id=${PLAYER_ID}`,
    ]);
  });

  it("discovers newly ingested laps without reloading the page", async () => {
    let availability = {
      ...AVAILABILITY,
      replay: null as typeof REFERENCE | null,
    };
    const recorder = installFetchRecorder({
      ...ROUTES,
      [AVAILABILITY_PATH]: () => availability,
    });
    const { client, container } = renderWithQueryClient(<HomeConsole />);
    await flushRequests();
    expect(container.textContent).toContain("has not published yet");
    availability = AVAILABILITY;
    await client.invalidateQueries({ queryKey: consoleKeys.availability });
    await flushRequests();
    expect(recorder.paths()).toContain(CONSOLE_REQUEST);
    expect(
      container.querySelector('svg[aria-label="Fixture Park circuit map"]'),
    ).not.toBeNull();
  });

  it("keeps the large payload cached when discovery is unchanged, then refetches on a new revision", async () => {
    let availability = AVAILABILITY;
    const recorder = installFetchRecorder({
      ...ROUTES,
      [AVAILABILITY_PATH]: () => availability,
    });
    const { client, container } = renderWithQueryClient(<HomeConsole />);
    await flushRequests();
    await client.invalidateQueries({ queryKey: consoleKeys.availability });
    await flushRequests();
    expect(recorder.countMatching(`${CONSOLE_PATH}/v3`)).toBe(1);
    availability = {
      ...AVAILABILITY,
      replay: { ...REFERENCE, revision: "1-5-5" },
    };
    await client.invalidateQueries({ queryKey: consoleKeys.availability });
    await flushRequests();
    expect(recorder.countMatching(`${CONSOLE_PATH}/v3`)).toBe(2);
    expect(container.textContent).not.toContain("has not published yet");
  });
});
