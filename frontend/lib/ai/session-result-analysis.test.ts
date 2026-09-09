import { describe, expect, it } from "vitest";
import { clutchAcceptanceCases } from "@/test/clutch-acceptance-cases";
import { renderArtifactMarkdown } from "./artifact-markdown";
import {
  buildSessionResultExecution,
  looksLikeSessionResultQuestion,
  RESULT_SESSION_CANDIDATES_SQL,
  type ResultSessionCandidate,
  resolveResultSession,
  SESSION_CLASSIFICATION_SQL,
  selectResultSession,
} from "./session-result-analysis";

const sessions: ResultSessionCandidate[] = [
  { id: 1, eventName: "Monaco Grand Prix", round: 8, date: "2024-05-26" },
  { id: 2, eventName: "British Grand Prix", round: 12, date: "2024-07-07" },
];

describe("session result analysis", () => {
  it("resolves event names and round references", () => {
    expect(resolveResultSession("the 2024 Monaco podium", sessions)?.id).toBe(
      1,
    );
    expect(resolveResultSession("who won round 12 in 2024", sessions)?.id).toBe(
      2,
    );
    expect(resolveResultSession("who won in 2024", sessions)).toBeNull();
    expect(
      selectResultSession("Who won this race?", sessions, {
        route: "/results/2024/8",
        sessionId: 1,
      })?.id,
    ).toBe(1);
  });

  it("renders only classification-backed podium claims", () => {
    const execution = buildSessionResultExecution({
      question: "Who finished on the podium at the 2024 Monaco Grand Prix?",
      season: 2024,
      sessionType: "race",
      session: sessions[0],
      rows: [
        {
          slug: "leclerc",
          driverName: "Charles Leclerc",
          position: 1,
          status: "Finished",
          gridPosition: 1,
          points: 25,
        },
        {
          slug: "piastri",
          driverName: "Oscar Piastri",
          position: 2,
          status: "Finished",
          gridPosition: 2,
          points: 18,
        },
        {
          slug: "sainz",
          driverName: "Carlos Sainz",
          position: 3,
          status: "Finished",
          gridPosition: 3,
          points: 15,
        },
        {
          slug: "norris",
          driverName: "Lando Norris",
          position: 4,
          status: "Finished",
          gridPosition: 4,
          points: 12,
        },
      ],
    });
    const markdown = renderArtifactMarkdown(execution.artifact);
    const expected = clutchAcceptanceCases.find(
      (testCase) => testCase.id === "result-monaco-2024-podium",
    )?.expected.exactFacts;

    expect(
      execution.artifact.metrics.map((metric) => metric.displayValue),
    ).toEqual([expected?.winner, expected?.second, expected?.third]);
    expect(markdown).toContain(`${expected?.winner} won`);
    expect(execution.artifact.tables[0].rows).toHaveLength(3);
    expect(markdown).not.toMatch(/dominant|controlled|comfortable/i);
  });

  it("only intercepts explicit result questions", () => {
    expect(looksLikeSessionResultQuestion("Who won Monaco in 2024?")).toBe(
      true,
    );
    expect(
      looksLikeSessionResultQuestion("Who won the 2024 championship?"),
    ).toBe(false);
    expect(looksLikeSessionResultQuestion("Tell me about Monaco")).toBe(false);
  });

  it("uses parameterized read-only SQL", () => {
    expect(RESULT_SESSION_CANDIDATES_SQL).toContain("year = $1");
    expect(SESSION_CLASSIFICATION_SQL).toContain("session_id = $1");
    expect(SESSION_CLASSIFICATION_SQL.trimStart()).toMatch(/^SELECT/i);
  });
});
