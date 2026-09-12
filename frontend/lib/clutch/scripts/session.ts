import type { RaceCornerInsight } from "@/lib/ai/race-corner-insight";
import type {
  ClutchScript,
  SlotValue,
  Surface,
  SurfaceDigest,
} from "@/lib/clutch/script";
import { teamTint } from "@/lib/consoleFormat";
import type { SessionResultDetail, SessionResultsResponse } from "@/lib/types";

export type SessionContext = SessionResultsResponse & {
  clutchInsight?: RaceCornerInsight | null;
};

/**
 * Catalogue order is the order the corner prefers: the first script the
 * session can fill is the one on the head. Race scripts need a grid and a
 * winner; a qualifying session falls through to `pole`.
 */
const SCRIPTS: ClutchScript[] = [
  {
    id: "race-insight",
    question: "{insight.question}",
    parts: [{ slot: "insight.answer" }],
    followups: [{ ask: "{insight.followup}" }],
  },
  {
    id: "winner",
    question: "Who won, and by how much?",
    parts: [
      { slot: "winner.name", tint: "driver" },
      { text: " won for " },
      { slot: "winner.team", tint: "team" },
      { text: " from P" },
      { slot: "winner.grid" },
      { text: " on the grid, " },
      { slot: "runnerUp.margin" },
      { text: " clear of " },
      { slot: "runnerUp.name", tint: "driver" },
      { text: "." },
    ],
    followups: [
      { script: "biggest-mover" },
      { ask: "What decided this race?" },
    ],
  },
  {
    id: "biggest-mover",
    question: "Who gained the most places?",
    parts: [
      { slot: "mover.name", tint: "driver" },
      { text: " gained " },
      { slot: "mover.gain" },
      { text: " places, from P" },
      { slot: "mover.grid" },
      { text: " on the grid to P" },
      { slot: "mover.position" },
      { text: " at the flag." },
    ],
    followups: [
      { script: "retirements" },
      { ask: "How did {mover.surname} gain those places?" },
    ],
  },
  {
    id: "retirements",
    question: "How many cars didn't finish?",
    parts: [
      { slot: "dnf.count" },
      { text: " of " },
      { slot: "field.count" },
      { text: " cars failed to finish: " },
      { slot: "dnf.list" },
      { text: "." },
    ],
    followups: [{ script: "winner" }, { ask: "Why did {dnf.first} retire?" }],
  },
  {
    id: "pole",
    question: "Who took pole, and by how much?",
    parts: [
      { slot: "pole.name", tint: "driver" },
      { text: " took pole for " },
      { slot: "pole.team", tint: "team" },
      { text: ", " },
      { slot: "pole.margin" },
      { text: " ahead of " },
      { slot: "front.name", tint: "driver" },
      { text: "." },
    ],
    followups: [
      { ask: "What decided this qualifying session?" },
      { ask: "How close was the fight for the front row?" },
    ],
  },
];

/** A row's identity, without a colour — teams carry their own. */
function driverValue(
  row: SessionResultDetail,
  text = row.driver.full_name,
): SlotValue {
  return {
    text,
    code: row.driver.driver_code ?? row.driver.full_name,
    color: teamTint(row.team.team_color),
  };
}

function teamValue(row: SessionResultDetail): SlotValue {
  return {
    text: row.team.name,
    code: row.team.constructor_slug ?? row.team.name,
    color: teamTint(row.team.team_color),
  };
}

function plain(text: string | number | null | undefined): SlotValue | null {
  return text == null || text === ""
    ? null
    : { text: String(text), code: null };
}

function surnameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : fullName;
}

function seconds(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return `${value.toFixed(3).replace(/\.?0+$/, "")}s`;
}

function classified(context: SessionContext): SessionResultDetail[] {
  return context.results.filter((row) => row.position != null);
}

function atPosition(
  context: SessionContext,
  position: number,
): SessionResultDetail | undefined {
  return context.results.find((row) => row.position === position);
}

function rowSlot(
  row: SessionResultDetail | undefined,
  field: string,
): SlotValue | null {
  if (!row) return null;
  if (field === "name") return driverValue(row);
  if (field === "surname")
    return driverValue(row, surnameOf(row.driver.full_name));
  if (field === "team") return teamValue(row);
  if (field === "grid") return plain(row.grid_position);
  if (field === "position") return plain(row.position);
  return null;
}

function biggestMover(
  context: SessionContext,
): { row: SessionResultDetail; gain: number } | null {
  let best: { row: SessionResultDetail; gain: number } | null = null;
  for (const row of classified(context)) {
    if (row.grid_position == null || row.position == null) continue;
    const gain = row.grid_position - row.position;
    if (gain > 0 && (!best || gain > best.gain)) best = { row, gain };
  }
  return best;
}

function retired(context: SessionContext): SessionResultDetail[] {
  return context.results.filter((row) => row.position == null);
}

function resolveSlot(context: SessionContext, slot: string): SlotValue | null {
  const [group, field] = slot.split(".");
  if (!field) return null;

  if (group === "insight") {
    if (field === "question") return plain(context.clutchInsight?.question);
    if (field === "answer") return plain(context.clutchInsight?.answer);
    if (field === "followup")
      return plain(context.clutchInsight?.followupQuestion);
    return null;
  }

  if (group === "winner") return rowSlot(atPosition(context, 1), field);
  if (group === "runnerUp") {
    const second = atPosition(context, 2);
    if (field === "margin") return plain(seconds(second?.time_seconds));
    return rowSlot(second, field);
  }
  if (group === "mover") {
    const mover = biggestMover(context);
    if (field === "gain") return plain(mover?.gain);
    return rowSlot(mover?.row, field);
  }
  if (group === "field" && field === "count") {
    return context.results.length > 0 ? plain(context.results.length) : null;
  }
  if (group === "dnf") {
    const out = retired(context);
    if (out.length === 0) return null;
    if (field === "count") return plain(out.length);
    if (field === "first")
      return driverValue(out[0], surnameOf(out[0].driver.full_name));
    if (field === "list") {
      return plain(
        out.map((row) => surnameOf(row.driver.full_name)).join(", "),
      );
    }
    return null;
  }
  if (group === "pole") {
    const first = atPosition(context, 1);
    if (field === "margin") {
      const second = atPosition(context, 2);
      if (first?.q3_time_seconds == null || second?.q3_time_seconds == null) {
        return null;
      }
      return plain(seconds(second.q3_time_seconds - first.q3_time_seconds));
    }
    return first?.q3_time_seconds != null ? rowSlot(first, field) : null;
  }
  if (group === "front") return rowSlot(atPosition(context, 2), field);
  return null;
}

function digest(context: SessionContext): SurfaceDigest | null {
  const { session } = context;
  if (!session?.id) return null;
  return {
    kind: "session",
    sessionId: session.id,
    sessionType: session.session_type,
    season: session.year,
    round: session.round,
    winner: atPosition(context, 1)?.driver.driver_code ?? null,
    fastestLap:
      context.results.find((row) => row.fastest_lap)?.driver.driver_code ??
      null,
    classified: classified(context).length,
  };
}

export const SESSION_SURFACE: Surface<SessionContext> = {
  scripts: SCRIPTS,
  resolveSlot,
  digest,
};
