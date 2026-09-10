import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAIParamQuery } from "./db";
import { getSeasonContext } from "./season-context-tool";

vi.mock("./db", () => ({
  executeAIParamQuery: vi.fn(),
}));

const standingRows = [
  {
    entity_type: "driver",
    position: 1,
    entrant_name: "Kimi Antonelli",
    entrant_slug: "antonelli",
    team_name: "Mercedes",
    team_color: "27F4D2",
    points: 267,
    wins: 7,
    podiums: 11,
  },
  {
    entity_type: "driver",
    position: 2,
    entrant_name: "George Russell",
    entrant_slug: "russell",
    team_name: "Mercedes",
    team_color: "27F4D2",
    points: 201,
    wins: 2,
    podiums: 7,
  },
  {
    entity_type: "constructor",
    position: 1,
    entrant_name: "Mercedes",
    entrant_slug: "mercedes",
    team_name: "Mercedes",
    team_color: "27F4D2",
    points: 468,
    wins: 9,
    podiums: 18,
  },
  {
    entity_type: "constructor",
    position: 2,
    entrant_name: "Ferrari",
    entrant_slug: "ferrari",
    team_name: "Ferrari",
    team_color: "E8002D",
    points: 346,
    wins: 2,
    podiums: 9,
  },
];

const resultRows = [
  {
    round: 1,
    event_name: "Australian Grand Prix",
    session_type: "race",
    driver_slug: "antonelli",
    driver_name: "Kimi Antonelli",
    team_color: "27F4D2",
    position: 1,
    points: 25,
  },
  {
    round: 1,
    event_name: "Australian Grand Prix",
    session_type: "race",
    driver_slug: "russell",
    driver_name: "George Russell",
    team_color: "27F4D2",
    position: 2,
    points: 18,
  },
  {
    round: 2,
    event_name: "Chinese Grand Prix",
    session_type: "race",
    driver_slug: "antonelli",
    driver_name: "Kimi Antonelli",
    team_color: "27F4D2",
    position: 1,
    points: 25,
  },
  {
    round: 2,
    event_name: "Chinese Grand Prix",
    session_type: "race",
    driver_slug: "russell",
    driver_name: "George Russell",
    team_color: "27F4D2",
    position: 2,
    points: 18,
  },
];

describe("getSeasonContext", () => {
  const mockedQuery = vi.mocked(executeAIParamQuery);

  beforeEach(() => {
    mockedQuery.mockReset();
    mockedQuery
      .mockResolvedValueOnce(standingRows)
      .mockResolvedValueOnce(resultRows);
  });

  it("returns one compact bundle with links, signed margins, and charts", async () => {
    // biome-ignore lint/style/noNonNullAssertion: tool always defines execute
    const result = await getSeasonContext.execute!({ season: 2026 }, {
      toolCallId: "test",
      messages: [],
    } as never);

    expect(mockedQuery).toHaveBeenCalledTimes(2);
    expect(mockedQuery.mock.calls[0][0]).toContain("MAX(team.team_color)");
    expect(mockedQuery.mock.calls[0][0]).not.toContain("JOIN teams");
    expect(result).toMatchObject({
      type: "season_context",
      completedRaces: 2,
      driverChampionshipMargin: "+66 points",
      constructorChampionshipMargin: "+122 points",
    });
    expect(result.drivers[0].href).toBe("/drivers/antonelli");
    expect(result.constructors[0].href).toBe("/constructors/mercedes");
    expect(result.charts).toHaveLength(3);
    expect(result.charts[0]).toMatchObject({
      chartType: "line",
      yKeys: ["antonelli", "russell"],
      seriesColors: {
        antonelli: "#27F4D2",
        russell: "#1bab93",
      },
    });
    expect(result.charts[1].categoryColors).toEqual({
      "Kimi Antonelli": "#27F4D2",
    });
    expect(result.charts[2].categoryColors).toEqual({
      Mercedes: "#27F4D2",
      Ferrari: "#E8002D",
    });
  });
});
