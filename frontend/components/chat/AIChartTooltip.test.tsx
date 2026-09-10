import { describe, expect, it } from "vitest";
import { formatAIChartValue } from "./AIChartTooltip";

describe("AI chart value formatting", () => {
  it("uses fan-friendly units", () => {
    expect(formatAIChartValue(267, "Points")).toBe("267 pts");
    expect(formatAIChartValue(1, "Wins")).toBe("1 win");
    expect(formatAIChartValue(7, "Wins")).toBe("7 wins");
    expect(formatAIChartValue(0.214, "Seconds")).toBe("+0.214s");
  });
});
