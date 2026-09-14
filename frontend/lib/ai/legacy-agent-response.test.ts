import { describe, expect, it } from "vitest";
import {
  agentErrorStage,
  agentOutcomeStatus,
  publicAgentErrorMessage,
  requireAgentAnswer,
} from "./legacy-agent-outcome";

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

describe("legacy agent outcome classification", () => {
  it("separates cancelled requests from failures", () => {
    const aborted = new Error("This operation was aborted");
    aborted.name = "AbortError";
    expect(agentOutcomeStatus(aborted)).toBe("aborted");
    expect(agentOutcomeStatus(new Error("Request cancelled"))).toBe("aborted");
    expect(agentOutcomeStatus(new Error("Timeout exceeded"))).toBe("error");
  });

  it("attributes empty answers to the stream and everything else to the model", () => {
    expect(
      agentErrorStage(new Error("Model completed without an answer")),
    ).toBe("stream");
    expect(agentErrorStage(new Error("Connect Timeout Error"))).toBe("model");
  });
});
