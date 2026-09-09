import { describe, expect, it } from "vitest";
import { renderArtifactMarkdown } from "./artifact-markdown";
import {
  buildWeatherAnalysisExecution,
  looksLikeWeatherAnalysis,
  SESSION_WEATHER_SQL,
} from "./weather-analysis";

const session = {
  id: 30,
  eventName: "Canadian Grand Prix",
  round: 9,
  date: "2024-06-09",
};

describe("weather analysis", () => {
  it("reports sample coverage without inventing competitive impact", () => {
    const execution = buildWeatherAnalysisExecution({
      question: "Was the 2024 Canadian Grand Prix affected by rain?",
      season: 2024,
      sessionType: "race",
      session,
      samples: [
        {
          airTemp: 18,
          trackTemp: 22,
          humidity: 80,
          windSpeed: 2,
          rainfall: true,
        },
        {
          airTemp: 19,
          trackTemp: 24,
          humidity: 70,
          windSpeed: 3,
          rainfall: false,
        },
      ],
    });
    const markdown = renderArtifactMarkdown(execution.artifact);

    expect(markdown).toContain("1 of 2 weather samples");
    expect(markdown).toContain("not its competitive effect");
    expect(execution.artifact.metrics[0].displayValue).toBe("1 of 2");
  });

  it("is explicit when no weather coverage exists", () => {
    const execution = buildWeatherAnalysisExecution({
      question: "Did it rain?",
      season: 1960,
      sessionType: "race",
      session: { ...session, eventName: "Monaco Grand Prix" },
      samples: [],
    });

    expect(execution.artifact.summary).toContain("cannot verify");
    expect(execution.artifact.metrics).toEqual([]);
  });

  it("recognizes weather language and uses parameterized SQL", () => {
    expect(looksLikeWeatherAnalysis("Was this a wet race?")).toBe(true);
    expect(SESSION_WEATHER_SQL).toContain("session_id = $1");
  });
});
