import { describe, expect, it } from "vitest";
import { buildClutchHref } from "./clutch-links";

describe("Clutch links", () => {
  it("carries the visible app state into the Ask route", () => {
    const href = buildClutchHref("Who won this race?", {
      route: "/results/2024/8",
      season: 2024,
      round: 8,
      sessionId: 79,
      sessionType: "race",
      driverSlugs: ["leclerc", "piastri"],
      activeFilters: { chart: "lap-times", sprint: false },
    });
    const url = new URL(href, "https://lapwise.dev");

    expect(url.pathname).toBe("/ask");
    expect(url.searchParams.get("q")).toBe("Who won this race?");
    expect(url.searchParams.get("from")).toBe("/results/2024/8");
    expect(url.searchParams.get("sessionId")).toBe("79");
    expect(url.searchParams.getAll("driver")).toEqual(["leclerc", "piastri"]);
    expect(url.searchParams.getAll("filter")).toEqual([
      "chart=lap-times",
      "sprint=false",
    ]);
  });
});
