import { describe, expect, it } from "vitest";
import { createClutchPreflightResponse, withClutchCors } from "./clutch-cors";

function request(origin?: string): Request {
  return new Request("https://clutch.example/api/ai/ask", {
    method: "OPTIONS",
    headers: origin ? { Origin: origin } : undefined,
  });
}

describe("Clutch cross-origin responses", () => {
  it("allows the production site to call the Railway origin", () => {
    const response = withClutchCors(
      request("https://lapwise.dev"),
      new Response(),
      {},
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://lapwise.dev",
    );
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "X-API-Key",
    );
    expect(response.headers.get("Vary")).toContain("Origin");
  });

  it("rejects an unknown preflight origin", () => {
    expect(
      createClutchPreflightResponse(request("https://bad.example"), {}),
    ).toHaveProperty("status", 403);
  });

  it("supports an explicit preview-site allowlist", () => {
    const response = createClutchPreflightResponse(
      request("https://preview.example"),
      { CLUTCH_ALLOWED_ORIGINS: "https://preview.example" },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://preview.example",
    );
  });
});
