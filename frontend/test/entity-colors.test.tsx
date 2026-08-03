// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEntityLinkColors } from "@/hooks/useEntityLinkColors";
import { useTeamColors } from "@/hooks/useTeamColors";
import * as fixtures from "./fixtures";
import {
  flushRequests,
  installFetchRecorder,
  renderWithQueryClient,
} from "./requestRecorder";

const STANDINGS_PATH = `/api/results/${fixtures.FIXTURE_SEASON}/standings`;

function ColorConsumers() {
  useEntityLinkColors();
  useTeamColors();
  return null;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("current-season color consumers", () => {
  it("records how many standings requests the color hooks issue together", async () => {
    const recorder = installFetchRecorder({
      [STANDINGS_PATH]: fixtures.standings,
    });
    renderWithQueryClient(<ColorConsumers />);
    await flushRequests();

    expect(recorder.countMatching(STANDINGS_PATH)).toBe(2);
  });
});
