import { describe, expect, it } from "vitest";

import {
  DRIVER_COUNTRY_CODES,
  getCountryName,
  getDriverFlagEmoji,
} from "./flags";

describe("driver nationality codes", () => {
  it("renders a flag for every stored code", () => {
    const missing = DRIVER_COUNTRY_CODES.filter(
      (code) => getDriverFlagEmoji(code) === "",
    );
    expect(missing).toEqual([]);
  });

  it("renders a country name for every stored code", () => {
    const missing = DRIVER_COUNTRY_CODES.filter(
      (code) => getCountryName(code) === code,
    );
    expect(missing).toEqual([]);
  });

  it("maps the F1-style codes that differ from ISO alpha-3", () => {
    expect(getDriverFlagEmoji("NED")).toBe("🇳🇱");
    expect(getDriverFlagEmoji("GER")).toBe("🇩🇪");
    expect(getDriverFlagEmoji("SUI")).toBe("🇨🇭");
    expect(getDriverFlagEmoji("MON")).toBe("🇲🇨");
    expect(getDriverFlagEmoji("RSA")).toBe("🇿🇦");
  });

  it("accepts lowercase codes", () => {
    expect(getDriverFlagEmoji("gbr")).toBe(getDriverFlagEmoji("GBR"));
    expect(getCountryName("gbr")).toBe("Great Britain");
  });

  it("returns empty output for unknown or missing codes", () => {
    expect(getDriverFlagEmoji(null)).toBe("");
    expect(getDriverFlagEmoji("XXX")).toBe("");
    expect(getCountryName(null)).toBe("Unknown");
    expect(getCountryName("XXX")).toBe("XXX");
  });
});
