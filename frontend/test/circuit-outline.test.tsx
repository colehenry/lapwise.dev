// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CircuitOutline from "@/components/home/CircuitOutline";
import {
  flushRequests,
  installFetchRecorder,
  renderWithQueryClient,
} from "./requestRecorder";

const POLYLINE_ROUTE = {
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
};

function renderOutline(circuitId: number) {
  return renderWithQueryClient(
    <CircuitOutline
      circuitId={circuitId}
      circuitName="Fixture Park"
      className="h-full w-full"
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CircuitOutline", () => {
  it("draws nothing until the polyline request has settled", () => {
    installFetchRecorder({ "/api/replay/track/14": POLYLINE_ROUTE });
    const { container } = renderOutline(14);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("draws the polyline once it arrives", async () => {
    installFetchRecorder({ "/api/replay/track/14": POLYLINE_ROUTE });
    const { container } = renderOutline(14);
    await flushRequests();

    expect(
      screen.getByRole("img", { name: "Fixture Park circuit map" }),
    ).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("falls back to the static map inside a positioned box when the polyline is refused", async () => {
    installFetchRecorder({});
    const { container } = renderOutline(14);
    await flushRequests();

    const image = container.querySelector("img");
    expect(image?.getAttribute("alt")).toBe("Fixture Park track map");
    expect(image?.parentElement?.className).toContain("relative");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("draws nothing for a circuit past the static set when the polyline is refused", async () => {
    installFetchRecorder({});
    const { container } = renderOutline(62);
    await flushRequests();

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });
});
