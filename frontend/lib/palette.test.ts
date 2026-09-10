import { describe, expect, it } from "vitest";
import {
  COMPOUND_COLORS,
  COMPOUND_NAMES_ALL,
  getCompoundColor,
  SERIES_COLORS,
} from "./palette";

describe("compound colours", () => {
  it("gives every compound in the database its own colour", () => {
    const resolved = COMPOUND_NAMES_ALL.map((c) => getCompoundColor(c));
    expect(new Set(resolved).size).toBe(COMPOUND_NAMES_ALL.length);
    expect(COMPOUND_NAMES_ALL).toHaveLength(
      Object.keys(COMPOUND_COLORS).length,
    );
  });

  it("covers the 2018-only compounds, which have no modern equivalent", () => {
    for (const legacy of ["HYPERSOFT", "ULTRASOFT", "SUPERSOFT", "SUPERHARD"]) {
      expect(getCompoundColor(legacy)).not.toBe("var(--delta-neutral)");
    }
  });

  it("falls back to neutral for a compound it does not know", () => {
    expect(getCompoundColor("TEST_UNKNOWN")).toBe("var(--delta-neutral)");
    expect(getCompoundColor(null)).toBe("var(--delta-neutral)");
  });
});

describe("chart series", () => {
  it("keeps the brand purple out of the data palette", () => {
    for (const token of SERIES_COLORS) {
      expect(token).not.toContain("--purple");
    }
  });
});
