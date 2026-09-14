// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClutchBand, { LEAD_IN, TYPE_RATE } from "@/components/home/ClutchBand";
import { type HomeContext, pickHomeScript } from "@/lib/clutch/scripts/home";
import { EMPTY_ENTITY_COLORS } from "@/lib/queries/standings";
import type { SessionResultsResponse } from "@/lib/types";
import * as fixtures from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

/** Drives requestAnimationFrame by hand so the typewriter can be stepped. */
function installClock() {
  let now = 0;
  const callbacks = new Set<FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    callbacks.add(cb);
    return callbacks.size;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.spyOn(performance, "now").mockImplementation(() => now);
  return {
    async advance(seconds: number) {
      now += seconds * 1000;
      const pending = [...callbacks];
      callbacks.clear();
      await act(async () => {
        for (const cb of pending) cb(now);
      });
    },
  };
}

const context: HomeContext = {
  season: fixtures.FIXTURE_SEASON,
  standings: fixtures.standings,
  latest: fixtures.latestRound,
  latestClassification:
    fixtures.raceClassification as unknown as SessionResultsResponse,
  roundsRun: fixtures.FIXTURE_ROUND,
};

function renderBand(ctx: HomeContext = context) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ClutchBand context={ctx} colors={EMPTY_ENTITY_COLORS} animate />
    </QueryClientProvider>,
  );
}

/** Everything the script will eventually have typed out. Selection runs the
 *  same way the band runs it, so the rotation's day-of-year pick cannot make
 *  this assert against a script that is not on screen. */
function fullAnswer(): string {
  const resolved = pickHomeScript(context);
  if (!resolved) throw new Error("the fixture standings must resolve a script");
  return resolved.segments.map((segment) => segment.text).join("");
}

let clock: ReturnType<typeof installClock>;

beforeEach(() => {
  clock = installClock();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the Clutch band's typewriter", () => {
  it("types the answer out to its full length", async () => {
    const { container } = renderBand();
    const answer = fullAnswer();

    await clock.advance(1);
    const partial = container.textContent ?? "";
    expect(partial).not.toContain(answer);

    // Comfortably past the lead-in plus the whole answer at 52 chars/sec.
    await clock.advance(answer.length / 40 + 2);
    expect(container.textContent).toContain(answer);
  });

  it("survives a parent that hands it a new context object mid-sentence", async () => {
    // HomeConsole rebuilt this object on every render, and the clock re-renders
    // it several times a second while the answer is still being typed.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const churn = () => (
      <QueryClientProvider client={client}>
        <ClutchBand
          context={{ ...context }}
          colors={EMPTY_ENTITY_COLORS}
          animate
        />
      </QueryClientProvider>
    );

    const answer = fullAnswer();
    const typingSeconds = answer.length / TYPE_RATE;
    const { container, rerender } = render(churn());

    // Half way through the sentence.
    await clock.advance(LEAD_IN + typingSeconds / 2);
    expect(container.textContent).not.toContain(answer);

    rerender(churn());
    await act(async () => {});

    // Exactly enough to finish, counted from the original start. A restart
    // here leaves the second half untyped.
    await clock.advance(typingSeconds / 2 + 0.1);
    expect(container.textContent).toContain(answer);
  });

  it("shows the whole answer at once when motion is not wanted", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const { container } = render(
      <QueryClientProvider client={client}>
        <ClutchBand
          context={context}
          colors={EMPTY_ENTITY_COLORS}
          animate={false}
        />
      </QueryClientProvider>,
    );
    await act(async () => {});
    expect(container.textContent).toContain(fullAnswer());
  });
});
