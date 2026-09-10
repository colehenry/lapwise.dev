import { describe, expect, it } from "vitest";
import type { StandingsResponse } from "./championshipTypes";
import { CLUTCH_SCRIPTS } from "./clutchScriptCatalogue";
import type { ClutchContext, ClutchScript } from "./homeClutchScript";
import { pickClutchScript, resolveScript } from "./homeClutchScript";
import type { SessionResultsResponse } from "./types";

function standings(): StandingsResponse {
  const scoring = {
    kind: "provisional",
    short_label: null,
    explanation: null,
    source_url: null,
    comparison_mode: "none" as const,
    has_discrepancy: false,
  };
  const driver = (
    position: number,
    code: string,
    fullName: string,
    points: number,
  ) => ({
    position,
    driver_code: code,
    driver_slug: fullName.toLowerCase().replace(" ", "-"),
    full_name: fullName,
    country_code: null,
    team_name: "Mercedes",
    team_color: "00D7B6",
    total_points: points,
    championship_points: points,
    points_scored: points,
    classification_status: "provisional" as const,
    scoring_explanation: null,
    scoring_explanation_url: null,
    headshot_url: null,
    wins: 1,
    p2s: 0,
    p3s: 0,
    position_counts: {},
  });
  const team = (position: number, name: string, points: number) => ({
    position,
    team_name: name,
    constructor_slug: name.toLowerCase(),
    team_color: "00D7B6",
    logo_url: null,
    total_points: points,
    championship_points: points,
    points_scored: points,
    classification_status: "provisional" as const,
    scoring_explanation: null,
    scoring_explanation_url: null,
    wins: 1,
    p2s: 0,
    p3s: 0,
    position_counts: {},
  });

  return {
    year: 2026,
    drivers: [
      driver(1, "ANT", "Kimi Antonelli", 267),
      driver(2, "RUS", "George Russell", 201),
      driver(3, "HAM", "Lewis Hamilton", 191),
    ],
    constructors: [
      team(1, "Mercedes", 468),
      team(2, "Ferrari", 346),
      team(3, "McLaren", 250),
    ],
    driver_scoring: scoring,
    constructor_scoring: scoring,
  };
}

const classification = {
  session: {},
  results: [
    {
      position: 1,
      grid_position: 19,
      time_seconds: 6675.281,
      status: "Finished",
    },
    { position: 2, grid_position: 2, time_seconds: 3.857, status: "Finished" },
  ],
} as unknown as SessionResultsResponse;

const full: ClutchContext = {
  season: 2026,
  standings: standings(),
  latest: {
    round: 13,
    event_name: "Italian Grand Prix",
    date: "2026-09-06",
    circuit_name: "Monza",
    circuit_id: 16,
    track_length_km: null,
    session_type: "race",
    podium: [
      {
        full_name: "Kimi Antonelli",
        driver_code: "ANT",
        driver_slug: "antonelli",
        country_code: "ITA",
        team_name: "Mercedes",
        team_color: "00D7B6",
        headshot_url: null,
        fastest_lap: true,
        time_seconds: 6675.281,
      },
    ],
  },
  latestClassification: classification,
  roundsRun: 13,
};

describe("resolveScript", () => {
  it("fills every slot from the standings in hand", () => {
    const resolved = resolveScript(CLUTCH_SCRIPTS[0], full);
    expect(resolved).not.toBeNull();
    const text = resolved?.segments.map((s) => s.text).join("") ?? "";
    expect(text).toContain("Kimi Antonelli");
    expect(text).toContain("267");
    expect(text).toContain("66 points");
    expect(resolved?.question).toContain("2026");
  });

  it("never lets a literal slot reach the screen", () => {
    const resolved = resolveScript(CLUTCH_SCRIPTS[0], full);
    const rendered = [
      resolved?.question ?? "",
      ...(resolved?.segments.map((s) => s.text) ?? []),
      ...(resolved?.followups ?? []),
    ].join(" ");
    expect(rendered).not.toMatch(/[{}]/);
  });

  it("tints only the segments the script asked to tint", () => {
    const resolved = resolveScript(CLUTCH_SCRIPTS[0], full);
    const tinted = resolved?.segments.filter((s) => s.code) ?? [];
    expect(tinted.map((s) => s.code)).toEqual([
      "ANT",
      "RUS",
      "HAM",
      "Mercedes",
      "Ferrari",
      "ANT",
    ]);
  });

  it("drops the whole script when a slot cannot be resolved", () => {
    expect(resolveScript(CLUTCH_SCRIPTS[0], { season: 2026 })).toBeNull();
    expect(
      resolveScript(CLUTCH_SCRIPTS[0], {
        season: null,
        standings: standings(),
      }),
    ).toBeNull();
  });

  it("drops a script whose follow-up chip is the unresolvable part", () => {
    const script: ClutchScript = {
      id: "test",
      question: "A question about {season}",
      parts: [{ text: "An answer." }],
      followups: ["What about {drivers.9.name}?"],
    };
    expect(resolveScript(script, full)).toBeNull();
  });
});

describe("pickClutchScript", () => {
  it("rotates by day of year", () => {
    const scripts: ClutchScript[] = [
      { id: "a", question: "A", parts: [{ text: "a" }], followups: [] },
      { id: "b", question: "B", parts: [{ text: "b" }], followups: [] },
    ];
    const first = pickClutchScript(
      full,
      new Date("2026-01-01T12:00:00Z"),
      scripts,
    );
    const second = pickClutchScript(
      full,
      new Date("2026-01-02T12:00:00Z"),
      scripts,
    );
    expect(first?.id).not.toBe(second?.id);
  });

  it("falls through to the next script that resolves", () => {
    const scripts: ClutchScript[] = [
      {
        id: "needs-margin",
        question: "Q",
        parts: [{ slot: "latest.margin" }],
        followups: [],
      },
      { id: "plain", question: "Q", parts: [{ text: "ok" }], followups: [] },
    ];
    expect(
      pickClutchScript(full, new Date("2026-01-01T12:00:00Z"), scripts)?.id,
    ).toBe("plain");
  });

  it("returns nothing rather than a half-filled sentence", () => {
    expect(pickClutchScript({ season: null })).toBeNull();
  });
});
