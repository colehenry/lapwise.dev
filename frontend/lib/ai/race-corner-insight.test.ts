import { describe, expect, it } from "vitest";
import { selectRaceCornerInsights } from "./race-corner-insight";
import type { RacePositionPath } from "./race-dynamics-calculation";
import type {
  DoubleStackEvent,
  PitTransitEvent,
  UndercutFailure,
} from "./race-strategy-events";

const stop: PitTransitEvent = {
  driverId: 4,
  driverCode: "NOR",
  driverName: "Lando Norris",
  teamId: 1,
  teamName: "McLaren",
  inLap: 10,
  outLap: 11,
  pitInTimeSeconds: 1000,
  pitOutTimeSeconds: 1029.615,
  transitSeconds: 29.615,
  beforeCompound: "SOFT",
  afterCompound: "MEDIUM",
  underNeutralization: false,
};

const finalResults = [
  {
    position: 1,
    grid_position: 19,
    driver_code: "ANT",
    full_name: "Andrea Kimi Antonelli",
    team_name: "Mercedes",
    status: "Finished",
    time_seconds: 6675.281,
  },
  {
    position: 2,
    grid_position: 2,
    driver_code: "RUS",
    full_name: "George Russell",
    team_name: "Mercedes",
    status: "Finished",
    time_seconds: 3.857,
  },
  {
    position: 3,
    grid_position: 5,
    driver_code: "VER",
    full_name: "Max Verstappen",
    team_name: "Red Bull Racing",
    status: "Finished",
    time_seconds: 14.718,
  },
  {
    position: 4,
    grid_position: 8,
    driver_code: "NOR",
    full_name: "Lando Norris",
    team_name: "McLaren",
    status: "Finished",
    time_seconds: 19.056,
  },
  {
    position: 18,
    grid_position: 17,
    driver_code: "PER",
    full_name: "Sergio Pérez",
    team_name: "Cadillac",
    status: "Lapped",
    time_seconds: 73.372,
  },
  {
    position: 19,
    grid_position: 16,
    driver_code: "BOT",
    full_name: "Valtteri Bottas",
    team_name: "Cadillac",
    status: "Lapped",
    time_seconds: 12.88,
  },
];

const positionPaths: RacePositionPath[] = [
  {
    driverCode: "ANT",
    driverName: "Andrea Kimi Antonelli",
    grid: 19,
    lap1: 16,
    best: 1,
    worst: 19,
    finish: 1,
    lapsLed: 9,
    firstP1Lap: 18,
  },
  {
    driverCode: "RUS",
    driverName: "George Russell",
    grid: 2,
    lap1: 2,
    best: 1,
    worst: 7,
    finish: 2,
    lapsLed: 40,
    firstP1Lap: 2,
  },
  {
    driverCode: "VER",
    driverName: "Max Verstappen",
    grid: 5,
    lap1: 5,
    best: 1,
    worst: 7,
    finish: 3,
    lapsLed: 3,
    firstP1Lap: 12,
  },
];

function evidence() {
  return {
    strategy: {
      undercutFailures: [] as UndercutFailure[],
      doubleStacks: [] as DoubleStackEvent[],
    },
    dynamics: {
      finalResults,
      leaderTimeline: [
        "L1 GAS",
        "L2-L11 RUS",
        "L12-L14 VER",
        "L15-L17 RUS",
        "L18-L22 ANT",
        "L23-L49 RUS",
        "L50-L53 ANT",
      ],
      lapsLed: { RUS: 40, ANT: 9, VER: 3, GAS: 1 },
      positionPaths,
    },
  };
}

describe("race corner insight selection", () => {
  it("ranks the P19 winner and other front finishers above a backmarker stack", () => {
    const input = evidence();
    input.strategy.doubleStacks.push({
      teamId: 7,
      teamName: "Cadillac",
      lapNumber: 27,
      first: {
        ...stop,
        driverId: 11,
        driverCode: "PER",
        driverName: "Sergio Pérez",
        teamId: 7,
        teamName: "Cadillac",
      },
      second: {
        ...stop,
        driverId: 77,
        driverCode: "BOT",
        driverName: "Valtteri Bottas",
        teamId: 7,
        teamName: "Cadillac",
      },
      arrivalGapSeconds: 2.781,
      secondTransitTaxSeconds: 6.824,
    });

    const insights = selectRaceCornerInsights(input);

    expect(insights.map(({ kind }) => kind)).toEqual([
      "winner_story",
      "lead_loss",
      "brief_leader",
    ]);
    expect(insights[0].question).toBe(
      "How did Antonelli go from P19 to victory?",
    );
    expect(insights[0].answer).toContain("gaining 18 positions");
    expect(
      insights.map(({ subjectFinishPosition }) => subjectFinishPosition),
    ).toEqual([1, 2, 3]);
  });

  it("describes how the leading driver covered a supported undercut", () => {
    const input = evidence();
    input.dynamics.lapsLed = { RUS: 0, ANT: 53, VER: 0, GAS: 0 };
    input.dynamics.positionPaths = [positionPaths[0]];
    input.strategy.undercutFailures.push({
      attacker: stop,
      target: {
        ...stop,
        driverId: 63,
        driverCode: "RUS",
        driverName: "George Russell",
        inLap: 13,
        outLap: 14,
        transitSeconds: 23.939,
      },
      gapBeforeSeconds: 0.975,
      gapAfterSeconds: 3.132,
      gapChangeSeconds: 2.157,
      newTyreGainSeconds: 1.231,
      comparedNewTyreLaps: 1,
      transitDeltaSeconds: 5.676,
    });

    const undercut = selectRaceCornerInsights(input).find(
      ({ kind }) => kind === "covered_undercut",
    );

    expect(undercut?.question).toBe("How did Russell cover Norris's undercut?");
    expect(undercut?.answer).toContain("gained 1.231s with newer tyres");
    expect(undercut?.answer).not.toMatch(
      /pit-lane transit|tyre gain|green-stop loss/i,
    );
  });

  it("does not promote an undercut without a full racing comparison lap", () => {
    const input = evidence();
    input.strategy.undercutFailures.push({
      attacker: stop,
      target: {
        ...stop,
        driverId: 63,
        driverCode: "RUS",
        driverName: "George Russell",
        inLap: 11,
        outLap: 12,
      },
      gapBeforeSeconds: 4.182,
      gapAfterSeconds: 0.537,
      gapChangeSeconds: -3.645,
      newTyreGainSeconds: 0,
      comparedNewTyreLaps: 0,
      transitDeltaSeconds: -0.719,
    });

    expect(
      selectRaceCornerInsights(input).some(
        ({ kind }) => kind === "covered_undercut",
      ),
    ).toBe(false);
  });

  it("does not claim a start-to-finish lead when lap data is unavailable", () => {
    const insights = selectRaceCornerInsights({
      strategy: { undercutFailures: [], doubleStacks: [] },
      dynamics: {
        finalResults: [
          {
            position: 1,
            grid_position: 1,
            driver_code: null,
            full_name: "Nino Farina",
            status: "Finished",
            time_seconds: 8000,
          },
          {
            position: 2,
            grid_position: 2,
            driver_code: null,
            full_name: "Luigi Fagioli",
            status: "Finished",
            time_seconds: 2.6,
          },
        ],
        lapsLed: {},
        positionPaths: [],
      },
    });

    expect(insights[0].question).toBe("What stands out about Farina's win?");
    expect(insights[0].answer).toBe(
      "Farina started P1 and won. Farina finished 2.600s ahead of Fagioli.",
    );
  });
});
