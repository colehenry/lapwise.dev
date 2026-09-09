import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./system-prompt";

describe("buildSystemPrompt", () => {
  it("uses a fan-first voice without exposing presentation mechanics", () => {
    const prompt = buildSystemPrompt({
      question: "Who had the better race in Monaco?",
    });

    expect(prompt).toContain("Write for a curious F1 fan");
    expect(prompt).toContain("sharp, enthusiastic F1 friend");
    expect(prompt).toContain("Keep the machinery invisible by default");
    expect(prompt).not.toContain("briefing the pit wall");
    expect(prompt).not.toContain("Format lap times as M:SS.mmm");
    expect(prompt).not.toContain("Colored deltas");
  });

  it("keeps capability answers short and free of backend detail", () => {
    const prompt = buildSystemPrompt({ question: "What can you do?" });

    expect(prompt).toContain("## Capability answer");
    expect(prompt).toContain("Do not list data sources, output formats");
    expect(prompt).toContain("Selected knowledge nodes: none");
    expect(prompt).not.toContain("sessions identifies event sessions");
  });
});
