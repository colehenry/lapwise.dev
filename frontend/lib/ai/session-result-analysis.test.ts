import { describe, expect, it } from "vitest";
import { clutchAcceptanceCases } from "@/test/clutch-acceptance-cases";
import { renderArtifactMarkdown } from "./artifact-markdown";
import {
  looksLikeLatestResultQuestion,
  looksLikeSessionResultQuestion,
  RESULT_SESSION_CANDIDATES_SQL,
  type ResultSessionCandidate,
  resolveResultSession,
  SESSION_CLASSIFICATION_SQL,
  selectResultSession,
} from "./session-result-analysis";
import { buildSessionResultExecution } from "./session-result-artifact";

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

  it("resolves the latest completed race without requiring a season", () => {
    expect(
      looksLikeLatestResultQuestion("Who won the most recent F1 race?"),
    ).toBe(true);
    expect(
      selectResultSession(
        "Who won the latest race?",
        sessions,
        undefined,
        "2024-06-01",
      )?.id,
    ).toBe(1);
    expect(
      selectResultSession(
        "Who won the latest race?",
        sessions,
        undefined,
        "2024-07-08",
      )?.id,
    ).toBe(2);
  });

  it("renders only classification-backed podium claims", () => {
    const execution = buildSessionResultExecution({
      question: "Who finished on the podium at the 2024 Monaco Grand Prix?",
      season: 2024,
      sessionType: "race",
      session: sessions[0],
      queries: [],
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
    expect(markdown).toContain(`${expected?.winner}](/drivers/leclerc) won`);
    expect(execution.artifact.tables[0].rows).toHaveLength(3);
    expect(markdown).not.toMatch(/dominant|controlled|comfortable/i);
  });

  it("renders a winner lookup as one linked sentence", () => {
    const execution = buildSessionResultExecution({
      question: "Who won the latest race?",
      season: 2024,
      sessionType: "race",
      session: sessions[1],
      queries: [],
      rows: [
        {
          slug: "hamilton",
          driverName: "Lewis Hamilton",
          position: 1,
          status: "Finished",
          gridPosition: null,
          points: 25,
        },
      ],
    });

    expect(renderArtifactMarkdown(execution.artifact)).toBe(
      "[Lewis Hamilton](/drivers/hamilton) won the [2024 British Grand Prix](/results/2024/12).",
    );
    expect(execution.artifact.metrics).toEqual([]);
    expect(execution.artifact.tables).toEqual([]);
  });

  it("adds only concise, classification-backed winner highlights", () => {
    const execution = buildSessionResultExecution({
      question: "Who won the latest race?",
      season: 2026,
      sessionType: "race",
      session: {
        id: 3,
        eventName: "Italian Grand Prix",
        round: 13,
      },
      rows: [
        {
          slug: "antonelli",
          driverName: "Kimi Antonelli",
          position: 1,
          status: "Finished",
          gridPosition: 19,
          points: 25,
          timeSeconds: 6675.281,
          fastestLap: true,
          teamName: "Mercedes",
        },
        {
          slug: "russell",
          driverName: "George Russell",
          position: 2,
          status: "Finished",
          gridPosition: 1,
          points: 18,
          timeSeconds: 3.857,
          fastestLap: false,
          teamName: "Mercedes",
        },
      ],
      queries: [],
    });
    const markdown = renderArtifactMarkdown(execution.artifact);

    expect(markdown).toContain("won the [2026 Italian Grand Prix]");
    expect(markdown).toContain(
      "Antonelli started 19th, set the fastest lap, finished 3.857 seconds ahead of teammate [George Russell](/drivers/russell), and completed a Mercedes 1–2.",
    );
    expect(markdown).not.toContain("53 laps");
    expect(markdown).not.toContain("|");
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
