import { describe, expect, it } from "vitest";
import { resolveAIChartPalette } from "./ai-chart-palette";
import type { ChartConfig } from "./chat";

const emptyColors = { driverColors: new Map(), teamColors: new Map() };

function chart(overrides: Partial<ChartConfig> = {}): ChartConfig {
  return {
    chartType: "line",
    title: "Chart",
    xLabel: "Round",
    yLabel: "Points",
    data: [{ round: 1, first: 25, second: 18 }],
    xKey: "round",
    yKeys: ["first", "second"],
    colors: [],
    ...overrides,
  };
}

describe("AI chart palette", () => {
  it("prefers explicit semantic series colors", () => {
    expect(
      resolveAIChartPalette(
        chart({ seriesColors: { first: "#27F4D2", second: "#E8002D" } }),
        emptyColors,
        "dark",
      ).series,
    ).toEqual(["#27F4D2", "#E8002D"]);
  });

  it("uses category colors for one-series team charts", () => {
    expect(
      resolveAIChartPalette(
        chart({
          chartType: "bar",
          data: [
            { team: "Mercedes", points: 468 },
            { team: "Ferrari", points: 346 },
          ],
          xKey: "team",
          yKeys: ["points"],
          categoryColors: { Mercedes: "#27F4D2", Ferrari: "#E8002D" },
        }),
        emptyColors,
        "dark",
      ).categories,
    ).toEqual(["#27F4D2", "#E8002D"]);
  });

  it("differentiates teammates that share an entity color", () => {
    const entityColors = {
      driverColors: new Map([
        ["Kimi Antonelli", "#27F4D2"],
        ["George Russell", "#27F4D2"],
      ]),
      teamColors: new Map(),
    };
    const palette = resolveAIChartPalette(
      chart({
        chartType: "bar",
        data: [
          { driver: "Kimi Antonelli", points: 267 },
          { driver: "George Russell", points: 201 },
        ],
        xKey: "driver",
        yKeys: ["points"],
      }),
      entityColors,
      "dark",
    );

    expect(palette.categories).toEqual(["#27F4D2", "#1bab93"]);
  });

  it("falls back to the shared site series palette", () => {
    const palette = resolveAIChartPalette(chart(), emptyColors, "dark");
    expect(palette.series).toEqual(["var(--series-1)", "var(--series-2)"]);
    expect(palette.categories).toBeNull();
  });
});
