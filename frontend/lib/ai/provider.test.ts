import { describe, expect, it } from "vitest";
import { resolveAnthropicBaseURL } from "./provider";

describe("resolveAnthropicBaseURL", () => {
  it("defaults to the versioned Anthropic endpoint", () => {
    expect(resolveAnthropicBaseURL(undefined)).toBe(
      "https://api.anthropic.com/v1",
    );
    expect(resolveAnthropicBaseURL("   ")).toBe("https://api.anthropic.com/v1");
  });

  it("appends the version an agent shell leaves off", () => {
    expect(resolveAnthropicBaseURL("https://api.anthropic.com")).toBe(
      "https://api.anthropic.com/v1",
    );
    expect(resolveAnthropicBaseURL("https://api.anthropic.com/")).toBe(
      "https://api.anthropic.com/v1",
    );
  });

  it("leaves an already versioned base URL alone", () => {
    expect(resolveAnthropicBaseURL("https://api.anthropic.com/v1")).toBe(
      "https://api.anthropic.com/v1",
    );
    expect(resolveAnthropicBaseURL("https://proxy.internal/anthropic/v2")).toBe(
      "https://proxy.internal/anthropic/v2",
    );
  });

  it("versions a proxy base URL that has a path", () => {
    expect(resolveAnthropicBaseURL("https://proxy.internal/anthropic")).toBe(
      "https://proxy.internal/anthropic/v1",
    );
  });
});
