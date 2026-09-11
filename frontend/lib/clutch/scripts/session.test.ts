import { describe, expect, it } from "vitest";
import type { SessionResultDetail, SessionResultsResponse } from "../../types";
import { firstScript, resolveScript } from "../script";
import { SESSION_SURFACE } from "./session";

function row(
  overrides: Partial<Omit<SessionResultDetail, "team">> & {
    code: string;
    name: string;
    team: string;
  },
): SessionResultDetail {
  const { code, name, team, ...rest } = overrides;
  return {
    position: null,
    status: "Finished",
    headshot_url: null,
    driver: {
      driver_number: null,
      driver_code: code,
      driver_slug: name.toLowerCase().replace(" ", "-"),
      full_name: name,
      country_code: null,
    },
    team: {
      name: team,
      constructor_slug: team.toLowerCase(),
      team_color: "FF8000",
      logo_url: null,
    },
    grid_position: null,
    points: null,
    laps_completed: null,
    time_seconds: null,
    fastest_lap: false,
    q1_time_seconds: null,
    q2_time_seconds: null,
    q3_time_seconds: null,
    ...rest,
  };
}

function session(
  sessionType: string,
  results: SessionResultDetail[],
): SessionResultsResponse {
  return {
    session: {
      id: 1234,
      year: 2025,
      round: 1,
      session_type: sessionType,
      event_name: "Australian Grand Prix",
      date: "2025-03-16",
      circuit: {
        id: 1,
        venue_slug: "albert-park",
        name: "Albert Park",
        location: "Melbourne",
        country: "Australia",
        track_length_km: 5.278,
        track_map_url: null,
      },
    },
    results,
  };
}

const race = session("race", [
  row({
    code: "NOR",
    name: "Lando Norris",
    team: "McLaren",
    position: 1,
    grid_position: 1,
    time_seconds: 5400.25,
  }),
  row({
    code: "VER",
    name: "Max Verstappen",
    team: "Red Bull",
    position: 2,
    grid_position: 3,
    time_seconds: 0.895,
  }),
  row({
    code: "RUS",
    name: "George Russell",
    team: "Mercedes",
    position: 3,
    grid_position: 4,
  }),
  row({
    code: "ALB",
    name: "Alexander Albon",
    team: "Williams",
    position: 5,
    grid_position: 12,
    fastest_lap: true,
  }),
  row({
    code: "PIA",
    name: "Oscar Piastri",
    team: "McLaren",
    position: null,
    grid_position: 2,
    status: "Retired",
  }),
]);

const qualifying = session("qualifying", [
  row({
    code: "NOR",
    name: "Lando Norris",
    team: "McLaren",
    position: 1,
    q3_time_seconds: 75.096,
  }),
  row({
    code: "PIA",
    name: "Oscar Piastri",
    team: "McLaren",
    position: 2,
    q3_time_seconds: 75.18,
  }),
]);

const text = (segments: { text: string }[] | undefined) =>
  segments?.map((segment) => segment.text).join("") ?? "";

describe("the session surface", () => {
  it("leads a race with the winner", () => {
    const resolved = firstScript(SESSION_SURFACE, race);
    expect(resolved?.id).toBe("winner");
    expect(text(resolved?.segments)).toBe(
      "Lando Norris won for McLaren from P1 on the grid, 0.895s clear of Max Verstappen.",
    );
    expect(resolved?.followups).toEqual([
      {
        kind: "script",
        id: "biggest-mover",
        question: "Who gained the most places?",
      },
      {
        kind: "script",
        id: "fastest-lap",
        question: "Who set the fastest lap?",
      },
      { kind: "ask", question: "What decided this race?" },
    ]);
  });

  it("tints named entities with their own team colour", () => {
    const resolved = firstScript(SESSION_SURFACE, race);
    const tinted = resolved?.segments.filter((segment) => segment.code);
    expect(tinted?.map((segment) => [segment.code, segment.color])).toEqual([
      ["NOR", "#FF8000"],
      ["mclaren", "#FF8000"],
      ["VER", "#FF8000"],
    ]);
  });

  it("works out the biggest mover and the retirements from the rows", () => {
    const scripts = Object.fromEntries(
      SESSION_SURFACE.scripts.map((script) => [script.id, script]),
    );
    expect(
      text(
        resolveScript(SESSION_SURFACE, scripts["biggest-mover"], race)
          ?.segments,
      ),
    ).toBe(
      "Alexander Albon gained 7 places, from P12 on the grid to P5 at the flag.",
    );
    const retirements = resolveScript(
      SESSION_SURFACE,
      scripts.retirements,
      race,
    );
    expect(text(retirements?.segments)).toBe(
      "1 of 5 cars failed to finish: Piastri.",
    );
    expect(retirements?.followups).toContainEqual({
      kind: "ask",
      question: "Why did Piastri retire?",
    });
  });

  it("falls through to pole for a qualifying session", () => {
    const resolved = firstScript(SESSION_SURFACE, qualifying);
    expect(resolved?.id).toBe("pole");
    expect(text(resolved?.segments)).toBe(
      "Lando Norris took pole for McLaren, 0.084s ahead of Oscar Piastri.",
    );
  });

  it("has nothing to say about an empty session", () => {
    expect(firstScript(SESSION_SURFACE, session("race", []))).toBeNull();
  });

  it("describes the session to the dock", () => {
    expect(SESSION_SURFACE.digest(race)).toEqual({
      kind: "session",
      sessionId: 1234,
      sessionType: "race",
      season: 2025,
      round: 1,
      winner: "NOR",
      fastestLap: "ALB",
      classified: 4,
    });
  });
});

describe("the session catalogue", () => {
  const ids = new Set(SESSION_SURFACE.scripts.map((script) => script.id));

  it("keeps every question short enough for one line", () => {
    for (const script of SESSION_SURFACE.scripts) {
      expect(script.question.length).toBeLessThanOrEqual(48);
    }
  });

  it("only points follow-ups at scripts in the same catalogue", () => {
    for (const script of SESSION_SURFACE.scripts) {
      for (const followup of script.followups) {
        if ("script" in followup) {
          expect(ids.has(followup.script)).toBe(true);
          expect(followup.script).not.toBe(script.id);
        }
      }
      expect(script.followups.length).toBeLessThanOrEqual(3);
    }
  });
});
