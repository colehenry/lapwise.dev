import { describe, expect, it } from "vitest";
import {
  analysisPageContextSchema,
  type PageSurface,
} from "./analysis-contracts";
import { describeAsked, describeSurface } from "./surfaces";
import { buildSystemPrompt } from "./system-prompt";

const session: PageSurface = {
  id: "winner",
  title: "Australian Grand Prix · Race",
  digest: {
    kind: "session",
    sessionId: 1234,
    sessionType: "race",
    season: 2025,
    round: 1,
    winner: "NOR",
    fastestLap: "ALB",
    classified: 18,
  },
  asked: [
    {
      question: "Who won, and by how much?",
      answer: "Lando Norris won for McLaren from P1, 0.895s clear.",
    },
  ],
};

describe("page surfaces", () => {
  it("is accepted as part of the page context, bounded", () => {
    const parsed = analysisPageContextSchema.parse({
      route: "/results/2025/1",
      sessionId: 1234,
      surface: session,
    });
    expect(parsed.surface?.digest.kind).toBe("session");

    expect(() =>
      analysisPageContextSchema.parse({
        route: "/results/2025/1",
        surface: { ...session, asked: Array(4).fill(session.asked[0]) },
      }),
    ).toThrow();
    expect(() =>
      analysisPageContextSchema.parse({
        route: "/results/2025/1",
        surface: { ...session, digest: { kind: "replay" } },
      }),
    ).toThrow();
  });

  it("reads as one sentence about the panel, plus what was answered", () => {
    expect(describeSurface(session)).toBe(
      'The reader is looking at "Australian Grand Prix · Race": the 2025 round 1 race (session id 1234; winner NOR, fastest lap ALB, 18 classified).',
    );
    expect(describeAsked(session)).toContain("Q: Who won, and by how much?");
    expect(describeAsked({ ...session, asked: [] })).toBe("");
    expect(
      describeSurface({
        id: "leader",
        title: "Standings",
        digest: {
          kind: "standings",
          season: 2026,
          mode: "drivers",
          leader: "ANT",
          gap: 66,
          roundsRun: 13,
          roundsLeft: null,
        },
        asked: [],
      }),
    ).toBe(
      'The reader is looking at "Standings": the 2026 drivers\' standings (leader ANT, gap 66 points, 13 rounds run).',
    );
  });

  it("reaches the system prompt as prose, not as JSON", () => {
    const prompt = buildSystemPrompt({
      question: "What decided this race?",
      pageContext: {
        route: "/results/2025/1",
        sessionId: 1234,
        surface: session,
      },
    });
    expect(prompt).toContain(
      'The reader is looking at "Australian Grand Prix · Race"',
    );
    expect(prompt).toContain("do not repeat them");
    expect(prompt).toContain('"sessionId":1234');
    expect(prompt).not.toContain('"asked"');
  });
});
