import type { StandingsResponse } from "@/lib/championshipTypes";
import {
  type ClutchScript,
  pickScript,
  type ResolvedScript,
  type SlotValue,
  type Surface,
  type SurfaceDigest,
} from "@/lib/clutch/script";
import type { RoundSummary, SessionResultsResponse } from "@/lib/types";

export type HomeContext = {
  season: number | null;
  standings?: StandingsResponse;
  latest?: RoundSummary;
  latestClassification?: SessionResultsResponse | null;
  roundsRun?: number;
  roundsUpcoming?: number;
};

/**
 * The authored questions and their answers. The prose is written; every number
 * in it is a slot resolved from responses the page already holds, so a script
 * cannot go stale between races.
 *
 * Adding one is adding an entry here. Nothing else changes.
 */
const SCRIPTS: ClutchScript[] = [
  {
    id: "championship-state",
    question: "Who is winning the {season} championship, and how close is it?",
    parts: [
      { slot: "drivers.1.name", tint: "driver" },
      { text: " leads the " },
      { slot: "season" },
      { text: " drivers' championship on " },
      { slot: "drivers.1.points" },
      { text: " points after " },
      { slot: "rounds.run" },
      { text: " rounds — " },
      { slot: "gap.drivers.1_2" },
      { text: " clear of " },
      { slot: "drivers.2.name", tint: "driver" },
      { text: ", with " },
      { slot: "drivers.3.name", tint: "driver" },
      { text: " a further " },
      { slot: "gap.drivers.2_3" },
      { text: " back.\n\n" },
      { slot: "constructors.1.team", tint: "team" },
      { text: " lead the constructors' championship from " },
      { slot: "constructors.2.team", tint: "team" },
      { text: " by " },
      { slot: "gap.constructors.1_2" },
      { text: ". Most recently " },
      { slot: "latest.winner", tint: "driver" },
      { text: " won the " },
      { slot: "latest.event" },
      { text: " from " },
      { slot: "latest.winnerGrid" },
      { text: ", " },
      { slot: "latest.margin" },
      { text: " clear of second." },
    ],
    visual: { kind: "points_progression", mode: "drivers", entities: "top3" },
    followups: [
      { ask: "Can {drivers.2.surname} still win it?" },
      { ask: "Points swing by round" },
      { ask: "{constructors.1.team} vs {constructors.2.team}" },
      { ask: "Every result this season" },
    ],
  },
];

function number(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function surnameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : fullName;
}

function driverSlot(
  context: HomeContext,
  rank: number,
  field: string,
): SlotValue | null {
  const driver = context.standings?.drivers?.[rank - 1];
  if (!driver) return null;
  const code = driver.driver_code ?? driver.full_name;
  if (field === "name") return { text: driver.full_name, code };
  if (field === "surname") return { text: surnameOf(driver.full_name), code };
  if (field === "code")
    return driver.driver_code ? { text: driver.driver_code, code } : null;
  if (field === "points") {
    const points = number(driver.total_points);
    return points ? { text: points, code: null } : null;
  }
  if (field === "wins") {
    const wins = number(driver.wins);
    return wins ? { text: wins, code: null } : null;
  }
  return null;
}

function constructorSlot(
  context: HomeContext,
  rank: number,
  field: string,
): SlotValue | null {
  const team = context.standings?.constructors?.[rank - 1];
  if (!team) return null;
  if (field === "team") return { text: team.team_name, code: team.team_name };
  if (field === "points") {
    const points = number(team.total_points);
    return points ? { text: points, code: null } : null;
  }
  if (field === "wins") {
    const wins = number(team.wins);
    return wins ? { text: wins, code: null } : null;
  }
  return null;
}

function gapSlot(context: HomeContext, path: string): SlotValue | null {
  const [kind, pair] = path.split(".");
  const [a, b] = (pair ?? "").split("_").map(Number);
  if (!a || !b) return null;
  const table =
    kind === "drivers"
      ? context.standings?.drivers
      : context.standings?.constructors;
  const first = table?.[a - 1];
  const second = table?.[b - 1];
  if (!first || !second) return null;
  const gap = number(first.total_points - second.total_points);
  return gap ? { text: `${gap} points`, code: null } : null;
}

function latestSlot(context: HomeContext, field: string): SlotValue | null {
  const latest = context.latest;
  if (!latest) return null;
  if (field === "event") return { text: latest.event_name, code: null };
  const winner = latest.podium?.[0];
  if (field === "winner") {
    return winner
      ? { text: winner.full_name, code: winner.driver_code ?? winner.full_name }
      : null;
  }
  const results = context.latestClassification?.results ?? [];
  const first = results.find((row) => row.position === 1);
  if (field === "winnerGrid") {
    const grid = number(first?.grid_position);
    return grid ? { text: `P${grid}`, code: null } : null;
  }
  if (field === "margin") {
    const second = results.find((row) => row.position === 2);
    const margin = number(second?.time_seconds);
    return margin ? { text: `${margin}s`, code: null } : null;
  }
  return null;
}

function resolveSlot(context: HomeContext, slot: string): SlotValue | null {
  if (slot === "season") {
    return context.season ? { text: String(context.season), code: null } : null;
  }
  if (slot === "rounds.run") {
    const run = number(context.roundsRun);
    return run ? { text: run, code: null } : null;
  }
  if (slot === "rounds.upcoming") {
    const upcoming = number(context.roundsUpcoming);
    return upcoming ? { text: upcoming, code: null } : null;
  }
  if (slot.startsWith("gap.")) return gapSlot(context, slot.slice(4));
  if (slot.startsWith("latest.")) return latestSlot(context, slot.slice(7));

  const [group, rank, field] = slot.split(".");
  const index = Number(rank);
  if (!index || !field) return null;
  if (group === "drivers") return driverSlot(context, index, field);
  if (group === "constructors") return constructorSlot(context, index, field);
  return null;
}

function digest(context: HomeContext): SurfaceDigest | null {
  if (!context.season) return null;
  const drivers = context.standings?.drivers ?? [];
  const leader = drivers[0];
  const runnerUp = drivers[1];
  return {
    kind: "standings",
    season: context.season,
    mode: "drivers",
    leader: leader?.driver_code ?? leader?.full_name ?? null,
    gap:
      leader && runnerUp ? leader.total_points - runnerUp.total_points : null,
    roundsRun: context.roundsRun ?? null,
    roundsLeft: context.roundsUpcoming ?? null,
  };
}

export const HOME_SURFACE: Surface<HomeContext> = {
  scripts: SCRIPTS,
  resolveSlot,
  digest,
};

export function pickHomeScript(
  context: HomeContext,
  now: Date = new Date(),
): ResolvedScript | null {
  return pickScript(HOME_SURFACE, context, now);
}
