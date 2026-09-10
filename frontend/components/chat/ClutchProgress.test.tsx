// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClutchProgress from "./ClutchProgress";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ClutchProgress", () => {
  it("paces stage changes and updates truthful metrics immediately", () => {
    const { rerender } = render(
      <ClutchProgress status={{ stage: "starting" }} />,
    );
    expect(screen.getByText("Warming up the tyres...")).toBeTruthy();

    rerender(<ClutchProgress status={{ stage: "season" }} />);
    act(() => vi.advanceTimersByTime(2_199));
    expect(screen.getByText("Warming up the tyres...")).toBeTruthy();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Following the title fight...")).toBeTruthy();

    rerender(
      <ClutchProgress
        status={{
          stage: "season",
          metrics: [
            { value: 13, label: "rounds checked" },
            { value: 3, label: "visuals ready" },
          ],
        }}
      />,
    );
    expect(
      screen.getByText("13 rounds checked · 3 visuals ready"),
    ).toBeTruthy();
  });
});
