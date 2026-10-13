// @vitest-environment jsdom
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomeConsole from "@/components/home/HomeConsole";
import ClutchDockProvider from "@/components/providers/ClutchDockProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { consoleKeys } from "@/lib/queries/consoleReplay";
import { prefetchHomeForHydration } from "@/lib/queries/homePrefetch";
import { sessionKeys } from "@/lib/queries/sessions";
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
const reference = { season: SEASON, round: ROUND, revision: "1-4-4" };
const availabilityPath = "/api/replay/console/availability";
const replayPath = `/api/replay/console/${SEASON}/${ROUND}/v3?revision=${reference.revision}`;
const classificationPath = `/api/results/${SEASON}/${ROUND}`;
const routes = {
  [availabilityPath]: {
    season: SEASON,
    latest: fixtures.latestRound,
    replay: reference,
  },
  [replayPath]: fixtures.consoleReplay,
  [`/api/results/${SEASON}/standings`]: fixtures.standings,
  [`/api/headlines?season=${SEASON}`]: fixtures.headlines,
  [classificationPath]: { session: {}, results: [] },
};

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("public homepage prefetch", () => {
  it("renders the map in the server HTML and avoids duplicate public requests after hydration", async () => {
    const server = installFetchRecorder(routes);
    const state = await prefetchHomeForHydration();
    expect(state.queries).toHaveLength(5);
    expect(server.paths()).toEqual([
      availabilityPath,
      replayPath,
      `/api/results/${SEASON}/standings`,
      `/api/headlines?season=${SEASON}`,
      classificationPath,
    ]);
    const calls = vi.mocked(fetch).mock.calls;
    for (const [, options] of calls) {
      expect(options).toMatchObject({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      });
      expect(options).not.toHaveProperty("next");
      expect(options?.headers).not.toHaveProperty("Authorization");
    }

    const client = new QueryClient();
    const html = renderToString(
      <ThemeProvider>
        <QueryClientProvider client={client}>
          <ClutchDockProvider>
            <HydrationBoundary state={state}>
              <HomeConsole />
            </HydrationBoundary>
          </ClutchDockProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    client.clear();
    expect(html).toContain('aria-label="Fixture Park circuit map"');
    expect(html).not.toContain("Loading the lap record");
    expect(JSON.stringify(state)).not.toContain("daily-games");
    expect(server.paths()).not.toContain("/api/games/summary");

    window.localStorage.setItem("lapwise:daily-games:player", "private-player");
    const browser = installFetchRecorder({
      "/api/games/summary?anon_id=private-player": { games: [] },
    });
    const { client: browserClient } = renderWithQueryClient(
      <HydrationBoundary state={state}>
        <HomeConsole />
      </HydrationBoundary>,
    );
    await flushRequests();
    expect(browser.paths().sort()).toEqual([
      "/api/games/summary?anon_id=private-player",
      `/api/replay/console/${SEASON}/${ROUND}/telemetry/VER`,
    ]);
    browserClient.clear();
  });

  it("selects older playback while prefetching the latest classification", async () => {
    const recorder = installFetchRecorder({
      ...routes,
      [availabilityPath]: {
        season: SEASON,
        latest: { ...fixtures.latestRound, round: 4 },
        replay: reference,
      },
      [`/api/results/${SEASON}/4`]: { session: {}, results: [] },
    });
    const state = await prefetchHomeForHydration();
    expect(recorder.paths()).toContain(replayPath);
    expect(recorder.paths()).toContain(`/api/results/${SEASON}/4`);
    expect(
      state.queries.find(
        (query) =>
          JSON.stringify(query.queryKey) ===
          JSON.stringify(sessionKeys.session(SEASON, 4, "race", null)),
      ),
    ).toBeDefined();
  });

  it("prefetches only an outline when the selected replay is absent", async () => {
    const recorder = installFetchRecorder({
      ...routes,
      [availabilityPath]: {
        season: SEASON,
        latest: { ...fixtures.latestRound, circuit_id: 16 },
        replay: null,
      },
      "/api/replay/track/16": fixtures.consoleReplay.track,
    });
    const state = await prefetchHomeForHydration();
    expect(recorder.paths()).toContain("/api/replay/track/16");
    expect(recorder.paths()).not.toContain(replayPath);
    expect(state.queries).toHaveLength(5);
  });

  it("does not probe nonexistent rounds when the archive is empty", async () => {
    const recorder = installFetchRecorder({
      [availabilityPath]: { season: null, latest: null, replay: null },
    });
    const state = await prefetchHomeForHydration();
    expect(state.queries).toHaveLength(1);
    expect(recorder.paths()).toEqual([availabilityPath]);
  });

  it("keeps successful panels when another public prefetch fails", async () => {
    installFetchRecorder({
      ...routes,
      [replayPath]: new Response("unavailable", { status: 503 }),
    });
    const state = await prefetchHomeForHydration();
    expect(state.queries).toHaveLength(4);
    expect(state.queries.map((query) => query.queryKey)).not.toContainEqual(
      consoleKeys.replay(reference),
    );
    const browser = installFetchRecorder(routes);
    const { client } = renderWithQueryClient(
      <HydrationBoundary state={state}>
        <HomeConsole />
      </HydrationBoundary>,
    );
    await flushRequests();
    expect(browser.countMatching(availabilityPath)).toBe(0);
    expect(browser.countMatching(replayPath)).toBe(1);
    client.clear();
  });

  it("degrades to ordinary browser fetching when discovery fails", async () => {
    installFetchRecorder({
      [availabilityPath]: new Response("unavailable", { status: 503 }),
    });
    expect((await prefetchHomeForHydration()).queries).toEqual([]);
  });

  it("bounds the entire prefetch, cancels slow requests, and preserves completed panels", async () => {
    vi.useFakeTimers();
    const recordedFetch = installFetchRecorder(routes);
    const respond = globalThis.fetch;
    let aborted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
        if (String(input).includes("/v3?")) {
          return new Promise<Response>((_, reject) =>
            options?.signal?.addEventListener("abort", () => {
              aborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            }),
          );
        }
        return respond(input, options);
      }),
    );
    const pending = prefetchHomeForHydration();
    await vi.advanceTimersByTimeAsync(2_000);
    const state = await pending;
    expect(aborted).toBe(true);
    expect(state.queries).toHaveLength(4);
    expect(recordedFetch.countMatching(availabilityPath)).toBe(1);
  });

  it("does not fetch dependent data if discovery uses up the deadline", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_: RequestInfo | URL, options?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const pending = prefetchHomeForHydration();
    await vi.advanceTimersByTimeAsync(2_000);
    expect((await pending).queries).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
