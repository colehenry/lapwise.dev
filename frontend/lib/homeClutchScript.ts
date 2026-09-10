import type { StandingsResponse } from "@/lib/championshipTypes";
import { CLUTCH_SCRIPTS } from "@/lib/clutchScriptCatalogue";
import type { RoundSummary, SessionResultsResponse } from "@/lib/types";

export type ScriptTint = "driver" | "team";

export type ScriptPart = { text: string } | { slot: string; tint?: ScriptTint };

export type ClutchVisual = {
  kind: "points_progression";
  mode: "drivers" | "constructors";
  entities: "top3";
};

export type ClutchScript = {
  id: string;
  question: string;
  parts: ScriptPart[];
  visual?: ClutchVisual;
  followups: string[];
};

export type ClutchContext = {
  season: number | null;
  standings?: StandingsResponse;
  latest?: RoundSummary;
  latestClassification?: SessionResultsResponse | null;
  roundsRun?: number;
  roundsUpcoming?: number;
};

export type ResolvedSegment = {
  text: string;
  /** The entity to take a colour from, or null for plain ink. */
  code: string | null;
  tint: ScriptTint | null;
};

export type ResolvedScript = {
  id: string;
  question: string;
  segments: ResolvedSegment[];
  visual?: ClutchVisual;
  followups: string[];
};

type SlotValue = { text: string; code: string | null };

function number(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function surnameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : fullName;
}

function driverSlot(
  context: ClutchContext,
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
  context: ClutchContext,
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

function gapSlot(context: ClutchContext, path: string): SlotValue | null {
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

function latestSlot(context: ClutchContext, field: string): SlotValue | null {
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

function resolveSlot(context: ClutchContext, slot: string): SlotValue | null {
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

/** Replaces `{slot}` occurrences, or returns null if any of them is unknown. */
function fillTemplate(context: ClutchContext, template: string): string | null {
  let failed = false;
  const filled = template.replace(/\{([^}]+)\}/g, (_, slot: string) => {
    const value = resolveSlot(context, slot.trim());
    if (!value) {
      failed = true;
      return "";
    }
    return value.text;
  });
  return failed ? null : filled;
}

/** An unresolvable slot drops the whole script; a literal never reaches screen. */
export function resolveScript(
  script: ClutchScript,
  context: ClutchContext,
): ResolvedScript | null {
  const question = fillTemplate(context, script.question);
  if (question === null) return null;

  const segments: ResolvedSegment[] = [];
  for (const part of script.parts) {
    if ("text" in part) {
      segments.push({ text: part.text, code: null, tint: null });
      continue;
    }
    const value = resolveSlot(context, part.slot);
    if (!value) return null;
    segments.push({
      text: value.text,
      code: part.tint ? value.code : null,
      tint: part.tint ?? null,
    });
  }

  const followups: string[] = [];
  for (const followup of script.followups) {
    const filled = fillTemplate(context, followup);
    if (filled === null) return null;
    followups.push(filled);
  }

  return {
    id: script.id,
    question,
    segments,
    visual: script.visual,
    followups,
  };
}

function dayOfYear(now: Date): number {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  return Math.floor((now.getTime() - start) / 86_400_000);
}

/**
 * The script of the day, or the next one that resolves. Returns null when no
 * script can be filled from the data in hand.
 */
export function pickClutchScript(
  context: ClutchContext,
  now: Date = new Date(),
  scripts: ClutchScript[] = CLUTCH_SCRIPTS,
): ResolvedScript | null {
  if (scripts.length === 0) return null;
  const offset = dayOfYear(now) % scripts.length;
  for (let i = 0; i < scripts.length; i++) {
    const resolved = resolveScript(
      scripts[(offset + i) % scripts.length],
      context,
    );
    if (resolved) return resolved;
  }
  return null;
}
