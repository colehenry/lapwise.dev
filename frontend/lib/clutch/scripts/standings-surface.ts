import type {
  ConstructorStanding,
  DriverStanding,
  StandingsResponse,
} from "@/lib/championshipTypes";
import type {
  ClutchScript,
  SlotValue,
  Surface,
  SurfaceDigest,
} from "@/lib/clutch/script";
import { teamTint } from "@/lib/consoleFormat";

export type StandingsContext = {
  standings: StandingsResponse;
  /** Races with a result so far; null when the page has not counted them. */
  roundsRun: number | null;
};

/**
 * Catalogue order is the order the corner prefers. `leader` needs two
 * classified drivers and a round count; a season with one round still
 * answers `constructors` or `wins`.
 */
const SCRIPTS: ClutchScript[] = [
  {
    id: "leader",
    question: "Who leads the championship, and by how much?",
    parts: [
      { slot: "drivers.1.name", tint: "driver" },
      { text: " leads on " },
      { slot: "drivers.1.points" },
      { text: " points after " },
      { slot: "rounds.run" },
      { text: " rounds, " },
      { slot: "gap.drivers.1_2" },
      { text: " clear of " },
      { slot: "drivers.2.name", tint: "driver" },
      { text: "." },
    ],
    followups: [
      { script: "constructors" },
      { script: "wins" },
      { ask: "Can {drivers.2.surname} still catch {drivers.1.surname}?" },
    ],
  },
  {
    id: "constructors",
    question: "Who leads the constructors' championship?",
    parts: [
      { slot: "constructors.1.team", tint: "team" },
      { text: " lead the constructors' championship on " },
      { slot: "constructors.1.points" },
      { text: " points, " },
      { slot: "gap.constructors.1_2" },
      { text: " ahead of " },
      { slot: "constructors.2.team", tint: "team" },
      { text: "." },
    ],
    followups: [
      { script: "leader" },
      { ask: "{constructors.1.team} vs {constructors.2.team} this season" },
    ],
  },
  {
    id: "wins",
    question: "Who has won the most races?",
    parts: [
      { slot: "mostWins.name", tint: "driver" },
      { text: " has the most wins this season with " },
      { slot: "mostWins.wins" },
      { text: " from " },
      { slot: "rounds.run" },
      { text: " rounds." },
    ],
    followups: [
      { script: "leader" },
      { ask: "Where did {mostWins.surname} win this season?" },
    ],
  },
];

function number(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function plain(text: string | null): SlotValue | null {
  return text ? { text, code: null } : null;
}

function surnameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : fullName;
}

function driverSlot(
  driver: DriverStanding | undefined,
  field: string,
): SlotValue | null {
  if (!driver) return null;
  const code = driver.driver_code ?? driver.full_name;
  const color = teamTint(driver.team_color);
  if (field === "name") return { text: driver.full_name, code, color };
  if (field === "surname")
    return { text: surnameOf(driver.full_name), code, color };
  if (field === "points") return plain(number(driver.total_points));
  if (field === "wins") return plain(number(driver.wins));
  return null;
}

function constructorSlot(
  team: ConstructorStanding | undefined,
  field: string,
): SlotValue | null {
  if (!team) return null;
  if (field === "team") {
    return {
      text: team.team_name,
      code: team.constructor_slug ?? team.team_name,
      color: teamTint(team.team_color),
    };
  }
  if (field === "points") return plain(number(team.total_points));
  if (field === "wins") return plain(number(team.wins));
  return null;
}

function gapSlot(context: StandingsContext, path: string): SlotValue | null {
  const [kind, pair] = path.split(".");
  const [a, b] = (pair ?? "").split("_").map(Number);
  if (!a || !b) return null;
  const table =
    kind === "drivers"
      ? context.standings.drivers
      : context.standings.constructors;
  const first = table[a - 1];
  const second = table[b - 1];
  if (!first || !second) return null;
  const gap = number(first.total_points - second.total_points);
  return gap ? { text: `${gap} points`, code: null } : null;
}

/** The driver with the most wins, or nobody when the top two are level. */
function mostWins(context: StandingsContext): DriverStanding | undefined {
  const ranked = [...context.standings.drivers].sort((a, b) => b.wins - a.wins);
  const [first, second] = ranked;
  if (!first || first.wins === 0) return undefined;
  if (second && second.wins === first.wins) return undefined;
  return first;
}

function resolveSlot(
  context: StandingsContext,
  slot: string,
): SlotValue | null {
  if (slot === "rounds.run") return plain(number(context.roundsRun));
  if (slot.startsWith("gap.")) return gapSlot(context, slot.slice(4));
  if (slot.startsWith("mostWins."))
    return driverSlot(mostWins(context), slot.slice(9));

  const [group, rank, field] = slot.split(".");
  const index = Number(rank);
  if (!index || !field) return null;
  if (group === "drivers")
    return driverSlot(context.standings.drivers[index - 1], field);
  if (group === "constructors")
    return constructorSlot(context.standings.constructors[index - 1], field);
  return null;
}

function digest(context: StandingsContext): SurfaceDigest | null {
  const [leader, runnerUp] = context.standings.drivers;
  return {
    kind: "standings",
    season: context.standings.year,
    mode: "drivers",
    leader: leader?.driver_code ?? leader?.full_name ?? null,
    gap:
      leader && runnerUp ? leader.total_points - runnerUp.total_points : null,
    roundsRun: context.roundsRun,
    roundsLeft: null,
  };
}

export const STANDINGS_SURFACE: Surface<StandingsContext> = {
  scripts: SCRIPTS,
  resolveSlot,
  digest,
};
