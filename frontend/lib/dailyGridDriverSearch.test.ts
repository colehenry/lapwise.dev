import { describe, expect, it } from "vitest";
import { findGameDrivers } from "./dailyGridDriverSearch";

const drivers = [
  {
    driver_slug: "jos-verstappen",
    full_name: "Jos Verstappen",
    driver_code: "VER",
    headshot_url: null,
    race_entries: 106,
  },
  {
    driver_slug: "max-verstappen",
    full_name: "Max Verstappen",
    driver_code: "VER",
    headshot_url: null,
    race_entries: 230,
  },
  {
    driver_slug: "jackie-lewis",
    full_name: "Jackie Lewis",
    driver_code: null,
    headshot_url: null,
    race_entries: 9,
  },
  {
    driver_slug: "hamilton",
    full_name: "Lewis Hamilton",
    driver_code: "HAM",
    headshot_url: null,
    race_entries: 380,
  },
];

describe("findGameDrivers", () => {
  it("ranks partial name matches by career race entries", () => {
    expect(findGameDrivers(drivers, "vers", new Set())[0].driver_slug).toBe(
      "max-verstappen",
    );
    expect(findGameDrivers(drivers, "lew", new Set())[0].driver_slug).toBe(
      "hamilton",
    );
  });

  it("removes drivers already placed on the grid", () => {
    const results = findGameDrivers(
      drivers,
      "vers",
      new Set(["max-verstappen"]),
    );

    expect(results.map((driver) => driver.driver_slug)).toEqual([
      "jos-verstappen",
    ]);
  });
});
