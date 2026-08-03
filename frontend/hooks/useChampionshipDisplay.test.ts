import { describe, expect, it } from "vitest";
import type { ConstructorStanding } from "@/lib/types";
import {
  displayedPoints,
  displayedPosition,
  orderRows,
} from "./useChampionshipDisplay";

function standing(
  team_name: string,
  position: number | null,
  championship_points: number | null,
  points_scored: number,
): ConstructorStanding {
  return {
    team_name,
    position,
    championship_points,
    points_scored,
    total_points: championship_points ?? 0,
    constructor_slug: team_name.toLowerCase(),
    team_color: null,
    logo_url: null,
    classification_status: position == null ? "excluded" : "classified",
    scoring_explanation: null,
    scoring_explanation_url: null,
    wins: 0,
    p2s: 0,
    p3s: 0,
    position_counts: {},
  };
}

describe("championship display modes", () => {
  const ferrari = standing("Ferrari", 1, 204, 204);
  const bmw = standing("BMW Sauber", 2, 101, 101);
  const mclaren = standing("McLaren", null, null, 218);

  it("uses official order by default and leaves excluded entrants below it", () => {
    expect(
      orderRows([mclaren, bmw, ferrari], "championship").map(
        (row) => row.team_name,
      ),
    ).toEqual(["Ferrari", "BMW Sauber", "McLaren"]);
  });

  it("sorts classified entrants by on-track points without promoting exclusions", () => {
    expect(
      orderRows([bmw, mclaren, ferrari], "scored").map((row) => row.team_name),
    ).toEqual(["Ferrari", "BMW Sauber", "McLaren"]);
  });

  it("renders the requested points and position semantics", () => {
    expect(displayedPoints(ferrari, "championship")).toBe(204);
    expect(displayedPoints(mclaren, "championship")).toBe(218);
    expect(displayedPoints(mclaren, "scored")).toBe(218);
    expect(displayedPosition(mclaren, 2, "scored")).toBe("—");
  });
});
