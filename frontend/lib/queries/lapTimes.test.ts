import { describe, expect, it } from "vitest";
import {
  lapSessionPath,
  lapTimeKeys,
  practiceSession,
  raceSession,
} from "./lapTimes";

const SEASON = 2026;
const ROUND = 11;

describe("lap-time query keys", () => {
  it("gives race, sprint, and each practice session a distinct key", () => {
    const keys = [
      raceSession(),
      raceSession(true),
      practiceSession(1),
      practiceSession(2),
      practiceSession(3),
    ].map((session) =>
      JSON.stringify(
        lapTimeKeys.session({ season: SEASON, round: ROUND, session }),
      ),
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives the same race session one key regardless of how it is built", () => {
    const explicit = lapTimeKeys.session({
      season: SEASON,
      round: ROUND,
      session: { kind: "race" },
    });
    const helper = lapTimeKeys.session({
      season: SEASON,
      round: ROUND,
      session: raceSession(false),
    });

    expect(explicit).toEqual(helper);
  });

  it("separates seasons and rounds", () => {
    expect(
      lapTimeKeys.session({
        season: 2025,
        round: ROUND,
        session: raceSession(),
      }),
    ).not.toEqual(
      lapTimeKeys.session({
        season: 2026,
        round: ROUND,
        session: raceSession(),
      }),
    );
    expect(
      lapTimeKeys.session({ season: SEASON, round: 1, session: raceSession() }),
    ).not.toEqual(
      lapTimeKeys.session({ season: SEASON, round: 2, session: raceSession() }),
    );
  });

  it("maps each session kind to its endpoint", () => {
    expect(lapSessionPath(SEASON, ROUND, raceSession())).toBe(
      `/api/results/${SEASON}/${ROUND}/lap-times`,
    );
    expect(lapSessionPath(SEASON, ROUND, raceSession(true))).toBe(
      `/api/results/${SEASON}/${ROUND}/sprint/lap-times`,
    );
    expect(lapSessionPath(SEASON, ROUND, practiceSession(2))).toBe(
      `/api/results/${SEASON}/${ROUND}/practice/2/lap-times`,
    );
  });
});
