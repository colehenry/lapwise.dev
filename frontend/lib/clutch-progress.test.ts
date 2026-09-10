import { describe, expect, it } from "vitest";
import {
  formatClutchProgressMetrics,
  idleProgressStage,
  pickClutchProgressMessage,
} from "./clutch-progress";

describe("Clutch progress copy", () => {
  it("selects a non-repeating message from the requested stage", () => {
    const first = pickClutchProgressMessage("qualifying", new Set(), () => 0);
    const second = pickClutchProgressMessage(
      "qualifying",
      new Set([first]),
      () => 0,
    );

    expect(first).toBe("Chasing purple sectors...");
    expect(second).not.toBe(first);
  });

  it("formats truthful progress metrics without backend language", () => {
    expect(
      formatClutchProgressMetrics([
        { value: 13, label: "rounds checked" },
        { value: 3, label: "visuals ready" },
      ]),
    ).toBe("13 rounds checked · 3 visuals ready");
  });

  it("moves a quiet startup into planning without changing real task stages", () => {
    expect(idleProgressStage("starting")).toBe("planning");
    expect(idleProgressStage("weather")).toBe("weather");
  });
});
