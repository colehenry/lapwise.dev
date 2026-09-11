import { describe, expect, it } from "vitest";
import {
  publicAgentErrorMessage,
  requireAgentAnswer,
} from "./legacy-agent-response";

describe("legacy agent failures", () => {
  it("rejects an empty model response", () => {
    expect(() => requireAgentAnswer("   ")).toThrow(/without an answer/);
  });

  it("returns useful public messages without exposing internals", () => {
    expect(publicAgentErrorMessage(new Error("Timeout exceeded"))).toMatch(
      /ran out of time/i,
    );
    const aborted = new Error("This operation was aborted");
    aborted.name = "AbortError";
    expect(publicAgentErrorMessage(aborted)).toMatch(/ran out of time/i);
    expect(
      publicAgentErrorMessage(new Error("Model completed without an answer")),
    ).toMatch(/couldn't finish/i);
    expect(
      publicAgentErrorMessage(new Error("secret internal failure")),
    ).not.toContain("secret");
  });
});
