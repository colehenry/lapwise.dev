// @vitest-environment jsdom
import { useQuery } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEntityLinkColors } from "@/hooks/useEntityLinkColors";
import {
  currentStandingsSeason,
  seasonStandingsQuery,
} from "@/lib/queries/standings";
import * as fixtures from "./fixtures";
import {
  flushRequests,
  installFetchRecorder,
  renderWithQueryClient,
} from "./requestRecorder";

const STANDINGS_PATH = `/api/results/${fixtures.FIXTURE_SEASON}/standings`;

/** Two independent consumers of the same current-season resource. */
function ColorConsumers() {
  useEntityLinkColors();
  useQuery(seasonStandingsQuery(currentStandingsSeason()));
  return null;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("current-season color consumers", () => {
  it("shares one standings request across consumers", async () => {
    const recorder = installFetchRecorder({
      [STANDINGS_PATH]: fixtures.standings,
    });
    renderWithQueryClient(<ColorConsumers />);
    await flushRequests();

    expect(recorder.countMatching(STANDINGS_PATH)).toBe(1);
  });

  it("derives driver and team colors from the shared response", async () => {
    installFetchRecorder({ [STANDINGS_PATH]: fixtures.standings });
    let colors: ReturnType<typeof useEntityLinkColors> | null = null;

    function Probe() {
      colors = useEntityLinkColors();
      return null;
    }

    renderWithQueryClient(<Probe />);
    await flushRequests();

    expect(colors?.driverColors.get("VER")).toBe("#3671C6");
    expect(colors?.teamColors.get("Red Bull Racing")).toBe("#3671C6");
  });

  it("falls back to empty maps when standings are unavailable", async () => {
    installFetchRecorder({});
    let colors: ReturnType<typeof useEntityLinkColors> | null = null;

    function Probe() {
      colors = useEntityLinkColors();
      return null;
    }

    renderWithQueryClient(<Probe />);
    await flushRequests();

    expect(colors?.driverColors.size).toBe(0);
    expect(colors?.teamColors.size).toBe(0);
  });
});
