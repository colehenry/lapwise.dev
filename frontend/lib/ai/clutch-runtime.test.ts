import { describe, expect, it } from "vitest";
import { missingClutchEnvironment } from "./clutch-runtime";

describe("Clutch runtime configuration", () => {
  it("reports every required production setting", () => {
    expect(missingClutchEnvironment({})).toEqual([
      "OPEN_ROUTER_API_KEY",
      "AI_DB_URL",
      "NEON_DATABASE_URL",
      "NEXT_PUBLIC_API_URL",
      "NEXT_PUBLIC_API_KEY",
    ]);
  });

  it("accepts a complete configuration", () => {
    expect(
      missingClutchEnvironment({
        OPEN_ROUTER_API_KEY: "key",
        AI_DB_URL: "readonly-db",
        NEON_DATABASE_URL: "app-db",
        NEXT_PUBLIC_API_URL: "https://api.example",
        NEXT_PUBLIC_API_KEY: "public-key",
      }),
    ).toEqual([]);
  });
});
