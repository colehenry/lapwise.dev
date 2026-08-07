import { describe, expect, it } from "vitest";
import { formatEvidence } from "./gridEvidence";

describe("formatEvidence", () => {
  it("renders constructor years as collapsed spans", () => {
    expect(
      formatEvidence({
        kind: "constructor",
        satisfied: true,
        constructor: "McLaren",
        spans: [
          [2007, 2012],
          [2015, 2015],
        ],
        entries: 246,
      }),
    ).toBe("McLaren 2007–2012, 2015 · 246 entries");
  });

  it("names the teams actually driven for when the header fails", () => {
    expect(
      formatEvidence({
        kind: "constructor",
        satisfied: false,
        constructor: "McLaren",
        drove_for: ["Ferrari", "Red Bull Racing"],
      }),
    ).toBe("Never at McLaren · drove for Ferrari, Red Bull Racing");
  });

  it("gives the nearest miss a number rather than a cross", () => {
    expect(
      formatEvidence({
        kind: "win_from_grid",
        satisfied: false,
        minimum: 6,
        best_grid: 4,
        race: { year: 2019, event: "German Grand Prix" },
      }),
    ).toBe("Best win from P4 · 2019 German Grand Prix");
  });

  it("reports the winning grid slot when the header holds", () => {
    expect(
      formatEvidence({
        kind: "win_from_grid",
        satisfied: true,
        minimum: 6,
        grid: 10,
        race: { year: 2008, event: "British Grand Prix" },
      }),
    ).toBe("Won from P10 · 2008 British Grand Prix");
  });

  it("singularises counts", () => {
    expect(
      formatEvidence({
        kind: "race_entries",
        satisfied: false,
        minimum: 100,
        entries: 1,
        first_year: 2011,
        last_year: 2011,
      }),
    ).toBe("1 entry, 2011–2011");
  });

  it("resolves a nationality code to a country name", () => {
    expect(
      formatEvidence({
        kind: "nationality",
        satisfied: true,
        country_code: "GBR",
        required: "GBR",
      }),
    ).toBe("Great Britain");
  });

  it("explains a self-referential teammate category", () => {
    expect(
      formatEvidence({
        kind: "named_teammate",
        satisfied: false,
        teammate: "Max Verstappen",
        self_reference: true,
      }),
    ).toBe("Is Max Verstappen");
  });

  it("returns null for a kind with no formatter, leaving the boolean floor", () => {
    expect(formatEvidence({ kind: "car_number", satisfied: true })).toBeNull();
  });

  it("does not resolve inherited object members as formatters", () => {
    expect(formatEvidence({ kind: "toString", satisfied: true })).toBeNull();
    expect(formatEvidence({ kind: "valueOf", satisfied: false })).toBeNull();
  });

  it("returns null rather than throwing on malformed evidence", () => {
    expect(
      formatEvidence({ kind: "multi_constructor_winner", satisfied: true }),
    ).toBe("No race wins");
  });
});
