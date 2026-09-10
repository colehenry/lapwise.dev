import { describe, expect, it } from "vitest";
import { pageContextFromSearchParams } from "./page-context";

describe("page context", () => {
  it("parses a contextual Clutch launch URL", () => {
    const params = new URLSearchParams({
      from: "/results/2024/8",
      season: "2024",
      round: "8",
      sessionId: "79",
      sessionType: "race",
    });
    params.append("driver", "leclerc");
    params.append("driver", "piastri");
    params.append("filter", "chart=lap-times");

    expect(pageContextFromSearchParams(params)).toEqual({
      route: "/results/2024/8",
      season: 2024,
      round: 8,
      sessionId: 79,
      sessionType: "race",
      driverSlugs: ["leclerc", "piastri"],
      activeFilters: { chart: "lap-times" },
    });
  });

  it("rejects untrusted routes and invalid session types", () => {
    expect(
      pageContextFromSearchParams(
        new URLSearchParams({ from: "https://example.com", season: "2024" }),
      ),
    ).toBeUndefined();
    expect(
      pageContextFromSearchParams(
        new URLSearchParams({ from: "/results", sessionType: "practice" }),
      ),
    ).toBeUndefined();
  });

  it("returns no context for a normal direct visit", () => {
    expect(pageContextFromSearchParams(new URLSearchParams())).toBeUndefined();
  });
});
