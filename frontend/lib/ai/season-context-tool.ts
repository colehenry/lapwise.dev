import { tool } from "ai";
import { z } from "zod";
import type { ChartConfig } from "../chat";
import { executeAIParamQuery } from "./db";

const SEASON_STANDINGS_SQL = `
  SELECT
    'driver' AS entity_type,
    championship_position AS position,
    driver_name AS entrant_name,
    driver_slug AS entrant_slug,
    team_name,
    points,
    wins,
    podiums
  FROM v_driver_standings
  WHERE year = $1 AND championship_position <= 5
  UNION ALL
  SELECT
    'constructor' AS entity_type,
    championship_position AS position,
    team_name AS entrant_name,
    constructor_slug AS entrant_slug,
    team_name,
    points,
    wins,
    podiums
  FROM v_constructor_standings
  WHERE year = $1 AND championship_position <= 5
`;

const SEASON_RESULTS_SQL = `
  SELECT
    s.round,
    s.event_name,
    s.session_type,
    d.slug AS driver_slug,
    d.full_name AS driver_name,
    sr.position,
    sr.points
  FROM sessions s
  JOIN session_results sr ON sr.session_id = s.id
  JOIN drivers d ON d.id = sr.driver_id
  WHERE s.year = $1
    AND s.session_type IN ('race', 'sprint_race')
    AND s.date <= CURRENT_DATE
  ORDER BY s.round, s.session_type, sr.position NULLS LAST
`;

interface Standing {
  type: "driver" | "constructor";
  position: number;
  name: string;
  slug: string;
  team: string | null;
  points: number;
  wins: number;
  podiums: number;
  href: string;
}

interface Result {
  round: number;
  event: string;
  sessionType: "race" | "sprint_race";
  driverSlug: string;
  driverName: string;
  position: number | null;
  points: number;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseStanding(row: Record<string, unknown>): Standing | null {
  const type = row.entity_type;
  const name = String(row.entrant_name ?? "").trim();
  const slug = String(row.entrant_slug ?? "").trim();
  const position = numberValue(row.position);
  if (
    (type !== "driver" && type !== "constructor") ||
    !name ||
    !slug ||
    position < 1
  ) {
    return null;
  }
  return {
    type,
    position,
    name,
    slug,
    team: typeof row.team_name === "string" ? row.team_name : null,
    points: numberValue(row.points),
    wins: numberValue(row.wins),
    podiums: numberValue(row.podiums),
    href: type === "driver" ? `/drivers/${slug}` : `/constructors/${slug}`,
  };
}

function parseResult(row: Record<string, unknown>): Result | null {
  const sessionType = row.session_type;
  const driverSlug = String(row.driver_slug ?? "").trim();
  const driverName = String(row.driver_name ?? "").trim();
  const round = numberValue(row.round);
  if (
    (sessionType !== "race" && sessionType !== "sprint_race") ||
    !driverSlug ||
    !driverName ||
    round < 1
  ) {
    return null;
  }
  const position = numberValue(row.position);
  return {
    round,
    event: String(row.event_name ?? `Round ${round}`),
    sessionType,
    driverSlug,
    driverName,
    position: position > 0 ? position : null,
    points: numberValue(row.points),
  };
}

function buildCumulativeChart(
  season: number,
  drivers: Standing[],
  results: Result[],
): ChartConfig {
  const slugs = new Set(drivers.map((driver) => driver.slug));
  const rounds = [...new Set(results.map((result) => result.round))].sort(
    (a, b) => a - b,
  );
  const totals = new Map(drivers.map((driver) => [driver.slug, 0]));
  const data = rounds.map((round) => {
    for (const result of results) {
      if (result.round !== round || !slugs.has(result.driverSlug)) continue;
      totals.set(
        result.driverSlug,
        (totals.get(result.driverSlug) ?? 0) + result.points,
      );
    }
    return { round, ...Object.fromEntries(totals) };
  });
  return {
    chartType: "line",
    title: `${season} championship points by round`,
    xLabel: "Round",
    yLabel: "Points",
    data,
    xKey: "round",
    yKeys: drivers.map((driver) => driver.slug),
    seriesLabels: drivers.map((driver) => driver.name),
    colors: [],
  };
}

function buildCharts(
  season: number,
  drivers: Standing[],
  constructors: Standing[],
  results: Result[],
): ChartConfig[] {
  const winCounts = new Map<string, { driver: string; wins: number }>();
  for (const result of results) {
    if (result.sessionType !== "race" || result.position !== 1) continue;
    const current = winCounts.get(result.driverSlug) ?? {
      driver: result.driverName,
      wins: 0,
    };
    current.wins += 1;
    winCounts.set(result.driverSlug, current);
  }
  return [
    buildCumulativeChart(season, drivers, results),
    {
      chartType: "pie",
      title: `${season} race wins`,
      xLabel: "Driver",
      yLabel: "Wins",
      data: [...winCounts.values()].sort((a, b) => b.wins - a.wins),
      xKey: "driver",
      yKeys: ["wins"],
      colors: [],
    },
    {
      chartType: "bar",
      title: `${season} Constructors' Championship`,
      xLabel: "Constructor",
      yLabel: "Points",
      data: constructors.map((team) => ({
        constructor: team.name,
        points: team.points,
      })),
      xKey: "constructor",
      yKeys: ["points"],
      colors: [],
    },
  ];
}

export const getSeasonContext = tool({
  description:
    "Get a complete season-level F1 context bundle for summaries, standings, trends, important data points, and visuals. Prefer this single tool over writing SQL for season questions.",
  inputSchema: z.object({
    season: z.number().int().min(1950).max(2100),
  }),
  execute: async ({ season }) => {
    const [standingRows, resultRows] = await Promise.all([
      executeAIParamQuery(SEASON_STANDINGS_SQL, [season]),
      executeAIParamQuery(SEASON_RESULTS_SQL, [season]),
    ]);
    const standings = standingRows
      .map(parseStanding)
      .filter((row): row is Standing => row !== null);
    const results = resultRows
      .map(parseResult)
      .filter((row): row is Result => row !== null);
    const drivers = standings
      .filter((row) => row.type === "driver")
      .sort((a, b) => a.position - b.position);
    const constructors = standings
      .filter((row) => row.type === "constructor")
      .sort((a, b) => a.position - b.position);
    const races = [
      ...new Set(
        results
          .filter((result) => result.sessionType === "race")
          .map((result) => result.round),
      ),
    ];
    const driverMargin =
      drivers.length > 1 ? drivers[0].points - drivers[1].points : null;
    const constructorMargin =
      constructors.length > 1
        ? constructors[0].points - constructors[1].points
        : null;

    return {
      type: "season_context" as const,
      season,
      completedRaces: races.length,
      driverChampionshipMargin:
        driverMargin === null ? null : `+${driverMargin} points`,
      constructorChampionshipMargin:
        constructorMargin === null ? null : `+${constructorMargin} points`,
      drivers,
      constructors,
      charts: buildCharts(season, drivers, constructors, results),
    };
  },
});
