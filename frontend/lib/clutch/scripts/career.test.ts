import { describe, expect, it } from "vitest";
import type {
  ConstructorProfile,
  DriverProfile,
  DriverSuperlative,
} from "../../types";
import { firstScript, resolveScript } from "../script";
import {
  CAREER_SURFACE,
  type CareerContext,
  constructorCareer,
  driverCareer,
} from "./career";

const hamilton: DriverProfile = {
  driver_code: "HAM",
  driver_slug: "lewis-hamilton",
  full_name: "Lewis Hamilton",
  driver_number: 44,
  country_code: "GB",
  headshot_url: null,
  total_seasons: 19,
  total_races: 356,
  total_championships: 7,
  total_wins: 105,
  total_podiums: 202,
  total_points: 4862.5,
  best_finish: 1,
  current_team: "Ferrari",
  current_team_color: "E80020",
  latest_season: 2025,
};

const superlatives: DriverSuperlative[] = [
  {
    id: "wins",
    value: "105",
    label: "Grand Prix wins",
    sublabel: "all-time leader",
    category: "record",
  },
  {
    id: "circuit_wins",
    value: "9",
    label: "Wins at British Grand Prix",
    sublabel: null,
    category: "circuit",
  },
];

const ferrari: ConstructorProfile = {
  team_name: "Ferrari",
  constructor_slug: "ferrari",
  team_color: "E80020",
  logo_url: null,
  total_seasons: 75,
  total_races: 1100,
  total_championships: 16,
  total_wins: 248,
  total_podiums: 830,
  total_points: 10000,
  best_finish: 1,
  latest_season: 2025,
};

const text = (context: CareerContext, id: string) => {
  const script = CAREER_SURFACE.scripts.find((entry) => entry.id === id);
  if (!script) throw new Error(id);
  return resolveScript(CAREER_SURFACE, script, context)
    ?.segments.map((segment) => segment.text)
    .join("");
};

describe("career surface", () => {
  it("sums a driver's record and links the name as a driver", () => {
    const career = driverCareer(hamilton, superlatives);
    const first = firstScript(CAREER_SURFACE, career);
    expect(first?.id).toBe("record");
    expect(first?.segments.map((segment) => segment.text).join("")).toBe(
      "Lewis Hamilton has 105 wins and 202 podiums from 356 races over 19 seasons, with 7 world championships.",
    );
    expect(first?.segments[0]).toMatchObject({
      code: "HAM",
      tint: "driver",
      color: "#E80020",
    });
    expect(first?.followups.map((followup) => followup.question)).toEqual([
      "Where did the wins come most often?",
      "How often did a podium become a win?",
      "What stands out about Lewis Hamilton's career?",
    ]);
  });

  it("reads the circuit and the all-time rank off the superlatives", () => {
    const career = driverCareer(hamilton, superlatives);
    expect(text(career, "best-circuit")).toBe(
      "9 of the 105 wins came at the British Grand Prix.",
    );
    expect(text(career, "wins-rank")).toBe(
      "105 wins ranks Lewis Hamilton first in Formula 1 history.",
    );
    const ranked = driverCareer(hamilton, [
      { ...superlatives[0], sublabel: "#22 all-time" },
    ]);
    expect(text(ranked, "wins-rank")).toContain("22nd in Formula 1 history");
    expect(text(driverCareer(hamilton), "best-circuit")).toBeUndefined();
    expect(text(driverCareer(hamilton), "wins-rank")).toBeUndefined();
  });

  it("gives the strike rate against starts", () => {
    expect(text(driverCareer(hamilton), "strike-rate")).toBe(
      "105 of the 202 podiums were wins, so 29% of 356 starts ended in victory.",
    );
    const rookie = driverCareer({
      ...hamilton,
      total_podiums: 0,
      total_wins: 0,
    });
    expect(text(rookie, "strike-rate")).toBeUndefined();
  });

  it("speaks of a constructor as a team, and links it as one", () => {
    const career = constructorCareer(ferrari);
    const first = firstScript(CAREER_SURFACE, career);
    expect(first?.segments.map((segment) => segment.text).join("")).toBe(
      "Ferrari has 248 wins and 830 podiums from 1100 races over 75 seasons, with 16 constructors' championships.",
    );
    expect(first?.segments[0]).toMatchObject({
      code: "ferrari",
      tint: "team",
    });
    expect(first?.followups.map((followup) => followup.question)).toEqual([
      "How often did a podium become a win?",
      "What stands out about Ferrari's career?",
    ]);
    expect(
      text(constructorCareer({ ...ferrari, total_championships: 1 }), "record"),
    ).toContain("with one constructors' championship.");
    expect(
      text(constructorCareer({ ...ferrari, total_championships: 0 }), "record"),
    ).toContain("without a constructors' championship.");
  });

  it("digests the career for the dock", () => {
    expect(CAREER_SURFACE.digest(driverCareer(hamilton))).toEqual({
      kind: "career",
      entity: "driver",
      slug: "HAM",
      seasons: 19,
      wins: 105,
      championships: 7,
    });
  });
});
