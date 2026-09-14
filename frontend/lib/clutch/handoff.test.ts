import { describe, expect, it } from "vitest";
import {
  handoffPageContext,
  remainingFollowups,
  seededMessages,
} from "./handoff";
import type { ResolvedScript } from "./script";

const leader: ResolvedScript = {
  id: "leader",
  question: "Who is leading?",
  segments: [
    { text: "Norris", code: "NOR", tint: "driver", color: "#FF8000" },
    { text: " is leading.", code: null, tint: null, color: null },
  ],
  followups: [
    { kind: "script", id: "margin", question: "By how much?" },
    { kind: "ask", question: "Can he hold on?" },
  ],
};
const margin: ResolvedScript = {
  id: "margin",
  question: "By how much?",
  segments: [{ text: "By 22 points.", code: null, tint: null, color: null }],
  followups: [
    { kind: "script", id: "leader", question: "Who is leading?" },
    { kind: "ask", question: "Can he hold on?" },
    { kind: "ask", question: "What does Piastri need?" },
  ],
};
const digest = {
  kind: "standings" as const,
  season: 2025,
  mode: "drivers" as const,
  leader: "NOR",
  gap: 22,
  roundsRun: 20,
  roundsLeft: 4,
};

describe("a corner hand-off", () => {
  it("adds the surface and the trail to the page context", () => {
    const context = handoffPageContext(
      { route: "/results/2025", season: 2025 },
      [leader, margin],
      "Standings",
      digest,
    );
    expect(context.surface).toEqual({
      id: "margin",
      title: "Standings",
      digest,
      asked: [
        { question: "Who is leading?", answer: "Norris is leading." },
        { question: "By how much?", answer: "By 22 points." },
      ],
    });
  });

  it("leaves the page context alone when the surface has no digest", () => {
    const base = { route: "/results/2025" };
    expect(handoffPageContext(base, [leader], "Standings", null)).toBe(base);
  });

  it("seeds the transcript with every answer read on the way", () => {
    const messages = seededMessages({
      seq: 3,
      question: "Can he hold on?",
      trail: [leader, margin],
      title: "Standings",
      pageContext: { route: "/results/2025" },
    });
    expect(messages.map((message) => [message.role, message.content])).toEqual([
      ["user", "Who is leading?"],
      ["assistant", "Norris is leading."],
      ["user", "By how much?"],
      ["assistant", "By 22 points."],
    ]);
    expect(new Set(messages.map((message) => message.id)).size).toBe(4);
  });

  it("offers only the follow-ups not already asked", () => {
    expect(
      remainingFollowups({
        seq: 1,
        question: "Can he hold on?",
        trail: [leader, margin],
        title: "Standings",
        pageContext: { route: "/results/2025" },
      }),
    ).toEqual(["What does Piastri need?"]);
  });
});
