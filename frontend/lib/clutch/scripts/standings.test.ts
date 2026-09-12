import { describe, expect, it } from "vitest";
import type {
  ConstructorStanding,
  DriverStanding,
  StandingsResponse,
} from "../../championshipTypes";
import { firstScript, resolveScript } from "../script";
import { STANDINGS_SURFACE, type StandingsContext } from "./standings";

const scoring = {
  kind: "provisional",
  short_label: null,
  explanation: null,
  source_url: null,
  comparison_mode: "none" as const,
  has_discrepancy: false,
};

function driver(
  position: number,
  code: string,
  fullName: string,
  points: number,
  wins: number,
): DriverStanding {
  return {
    position,
    driver_code: code,
    driver_slug: fullName.toLowerCase().replace(" ", "-"),
    full_name: fullName,
    country_code: null,
    team_name: "McLaren",
    team_color: "FF8000",
    total_points: points,
    championship_points: points,
    points_scored: points,
    classification_status: "provisional",
    scoring_explanation: null,
    scoring_explanation_url: null,
    headshot_url: null,
    wins,
    p2s: 0,
    p3s: 0,
    position_counts: {},
  };
}

function team(
  position: number,
  name: string,
  points: number,
): ConstructorStanding {
  return {
    position,
    team_name: name,
    constructor_slug: name.toLowerCase().replace(" ", "-"),
    team_color: "FF8000",
    logo_url: null,
    total_points: points,
    championship_points: points,
    points_scored: points,
    classification_status: "provisional",
    scoring_explanation: null,
    scoring_explanation_url: null,
    wins: 0,
    p2s: 0,
    p3s: 0,
    position_counts: {},
  };
}

function context(
  drivers: DriverStanding[],
  roundsRun: number | null = 14,
): StandingsContext {
  const standings: StandingsResponse = {
    year: 2025,
    drivers,
    constructors: [team(1, "McLaren", 559), team(2, "Ferrari", 260)],
    driver_scoring: scoring,
    constructor_scoring: scoring,
  };
  return { standings, roundsRun };
}

const midSeason = context([
  driver(1, "PIA", "Oscar Piastri", 284, 7),
  driver(2, "NOR", "Lando Norris", 275, 5),
  driver(3, "VER", "Max Verstappen", 187, 2),
]);

const text = (context: StandingsContext, id: string) => {
  const script = STANDINGS_SURFACE.scripts.find((entry) => entry.id === id);
  if (!script) throw new Error(id);
  return resolveScript(STANDINGS_SURFACE, script, context)
    ?.segments.map((segment) => segment.text)
    .join("");
};

describe("standings surface", () => {
  it("leads with the title fight, tinted and linked by driver", () => {
    const first = firstScript(STANDINGS_SURFACE, midSeason);
    expect(first?.id).toBe("leader");
    expect(first?.segments.map((segment) => segment.text).join("")).toBe(
      "Oscar Piastri leads on 284 points after 14 rounds, 9 points clear of Lando Norris.",
    );
    expect(first?.segments[0]).toMatchObject({
      code: "PIA",
      tint: "driver",
      color: "#FF8000",
    });
    expect(first?.followups.map((followup) => followup.question)).toEqual([
      "Who leads the constructors' championship?",
      "Who has won the most races?",
      "Can Norris still catch Piastri?",
    ]);
  });

  it("links a constructor by its slug", () => {
    const script = STANDINGS_SURFACE.scripts[1];
    const resolved = resolveScript(STANDINGS_SURFACE, script, midSeason);
    expect(resolved?.segments[0]).toMatchObject({
      text: "McLaren",
      code: "mclaren",
      tint: "team",
    });
    expect(text(midSeason, "constructors")).toBe(
      "McLaren lead the constructors' championship on 559 points, 299 points ahead of Ferrari.",
    );
  });

  it("names the winningest driver only when nobody is level", () => {
    expect(text(midSeason, "wins")).toBe(
      "Oscar Piastri has the most wins this season with 7 from 14 rounds.",
    );
    const level = context([
      driver(1, "PIA", "Oscar Piastri", 284, 5),
      driver(2, "NOR", "Lando Norris", 275, 5),
    ]);
    expect(text(level, "wins")).toBeUndefined();
  });

  it("falls through to the constructors when the round count is unknown", () => {
    const unknown = context(midSeason.standings.drivers, null);
    expect(firstScript(STANDINGS_SURFACE, unknown)?.id).toBe("constructors");
  });

  it("digests the leader and the gap for the dock", () => {
    expect(STANDINGS_SURFACE.digest(midSeason)).toEqual({
      kind: "standings",
      season: 2025,
      mode: "drivers",
      leader: "PIA",
      gap: 9,
      roundsRun: 14,
      roundsLeft: null,
    });
  });
});
