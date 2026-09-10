import { describe, expect, it } from "vitest";
import { renderArtifactMarkdown } from "./artifact-markdown";
import { tryRunRulesAnalysis } from "./rules-analysis";

describe("rules analysis", () => {
  it("answers the audited 2024 fastest-lap question from a knowledge node", () => {
    const execution = tryRunRulesAnalysis(
      "Could a driver still earn a fastest-lap point in 2024?",
    );

    expect(execution).not.toBeNull();
    if (!execution) throw new Error("Expected a deterministic rule answer");
    expect(execution.artifact.summary).toContain("Yes");
    expect(execution.artifact.summary).toContain("top ten");
    expect(execution.artifact.evidence[0].kind).toBe("knowledge_node");
    expect(renderArtifactMarkdown(execution.artifact)).toContain("1 point");
  });

  it("tracks the 2025 removal", () => {
    const execution = tryRunRulesAnalysis(
      "Could a driver earn a fastest lap point in 2025?",
    );
    expect(execution?.artifact.summary).toContain("removed");
    expect(execution?.artifact.metrics[0].value).toBe(0);
  });

  it("leaves unrelated or unscoped rules questions to clarification", () => {
    expect(tryRunRulesAnalysis("What is parc ferme?")).toBeNull();
    expect(
      tryRunRulesAnalysis("How does the fastest-lap point work?"),
    ).toBeNull();
  });
});
