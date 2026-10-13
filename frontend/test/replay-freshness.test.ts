// @vitest-environment jsdom
import {
  focusManager,
  QueryClient,
  QueryObserver,
} from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  consoleAvailabilityQuery,
  consoleReplayQuery,
} from "@/lib/queries/consoleReplay";
import { consoleTelemetryQuery } from "@/lib/queries/consoleTelemetry";
import { getJsonOrNull } from "@/lib/queries/http";
import { consoleReplay, latestRound } from "./fixtures";
import { installFetchRecorder } from "./requestRecorder";

const reference = { season: 2026, round: 1, revision: "1-4-4" };
const availability = { season: 2026, latest: latestRound, replay: reference };
const discoveryPath = "/api/replay/console/availability";
const replayPath = "/api/replay/console/2026/1/v3";

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function watch<T>(options: ConstructorParameters<typeof QueryObserver<T>>[1]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.mount();
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  disposers.push(() => {
    unsubscribe();
    client.unmount();
    client.clear();
  });
  return observer;
}

describe("homepage freshness", () => {
  it("checks discovery each minute while visible and pauses in a hidden tab", async () => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    const recorder = installFetchRecorder({ [discoveryPath]: availability });
    watch(consoleAvailabilityQuery());
    await vi.advanceTimersByTimeAsync(1);
    expect(recorder.countMatching(discoveryPath)).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(recorder.countMatching(discoveryPath)).toBe(2);
    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(recorder.countMatching(discoveryPath)).toBe(2);
    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(recorder.countMatching(discoveryPath)).toBe(3);
  });

  it("rechecks missing geometry then stops polling the completed payload", async () => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    let complete = false;
    const recorder = installFetchRecorder({
      [replayPath]: () => ({
        ...consoleReplay,
        track: complete ? consoleReplay.track : null,
      }),
    });
    const observer = watch(consoleReplayQuery(reference));
    await vi.advanceTimersByTimeAsync(1);
    expect(observer.getCurrentResult().data?.track).toBeNull();
    complete = true;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(observer.getCurrentResult().data?.track).toEqual(
      consoleReplay.track,
    );
    await vi.advanceTimersByTimeAsync(120_000);
    expect(recorder.countMatching(replayPath)).toBe(2);
  });

  it("does not keep a missing telemetry slice fresh for six hours", async () => {
    vi.useFakeTimers();
    focusManager.setFocused(true);
    const path = "/api/replay/console/2026/1/telemetry/VER";
    const recorder = installFetchRecorder({ [path]: null });
    watch(consoleTelemetryQuery(2026, 1, "VER"));
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(recorder.countMatching(path)).toBe(2);
  });
});

describe("nullable HTTP reads", () => {
  it("returns null only for a missing resource", async () => {
    installFetchRecorder({ "/missing": null });
    await expect(getJsonOrNull("/missing")).resolves.toBeNull();
  });

  it.each([401, 403, 429, 500, 503])(
    "reports HTTP %s as a failure",
    async (status) => {
      installFetchRecorder({ "/failure": new Response("failed", { status }) });
      await expect(getJsonOrNull("/failure")).rejects.toThrow(`HTTP ${status}`);
    },
  );
});
