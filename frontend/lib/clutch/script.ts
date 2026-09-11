/**
 * The unit Clutch speaks in: an authored question, an answer written as prose
 * with slots, and follow-ups. A surface owns its slot grammar; this module
 * only fills templates and refuses to render a sentence it cannot complete.
 */

export type ScriptTint = "driver" | "team";

export type ScriptPart = { text: string } | { slot: string; tint?: ScriptTint };

export type ClutchVisual = {
  kind: "points_progression";
  mode: "drivers" | "constructors";
  entities: "top3";
};

/**
 * `script` names another script in the same surface and answers in place if
 * it resolves; `ask` is a question for the dock and may carry slots.
 */
export type Followup = { script: string } | { ask: string };

export type ClutchScript = {
  id: string;
  question: string;
  parts: ScriptPart[];
  visual?: ClutchVisual;
  followups: Followup[];
};

export type SlotValue = { text: string; code: string | null };

export type SlotResolver<C> = (context: C, slot: string) => SlotValue | null;

/** What the dock is told about the panel a hand-off came from. */
export type SurfaceDigest = {
  kind: "standings";
  season: number;
  mode: "drivers" | "constructors";
  leader: string | null;
  gap: number | null;
  roundsRun: number | null;
  roundsLeft: number | null;
};

export type Surface<C> = {
  scripts: ClutchScript[];
  resolveSlot: SlotResolver<C>;
  digest: (context: C) => SurfaceDigest | null;
};

export type ResolvedSegment = {
  text: string;
  /** The entity to take a colour from, or null for plain ink. */
  code: string | null;
  tint: ScriptTint | null;
};

export type ResolvedFollowup =
  | { kind: "script"; id: string; question: string }
  | { kind: "ask"; question: string };

export type ResolvedScript = {
  id: string;
  question: string;
  segments: ResolvedSegment[];
  visual?: ClutchVisual;
  followups: ResolvedFollowup[];
};

/** Replaces `{slot}` occurrences, or returns null if any of them is unknown. */
function fillTemplate<C>(
  surface: Surface<C>,
  context: C,
  template: string,
): string | null {
  let failed = false;
  const filled = template.replace(/\{([^}]+)\}/g, (_, slot: string) => {
    const value = surface.resolveSlot(context, slot.trim());
    if (!value) {
      failed = true;
      return "";
    }
    return value.text;
  });
  return failed ? null : filled;
}

/**
 * A `script` follow-up that cannot resolve is dropped, never downgraded to an
 * `ask`; an `ask` follow-up with an unfillable slot fails the whole script.
 * Returns null for the latter, and an empty array is a valid result.
 */
function resolveFollowups<C>(
  surface: Surface<C>,
  context: C,
  script: ClutchScript,
): ResolvedFollowup[] | null {
  const followups: ResolvedFollowup[] = [];
  for (const followup of script.followups) {
    if ("ask" in followup) {
      const question = fillTemplate(surface, context, followup.ask);
      if (question === null) return null;
      followups.push({ kind: "ask", question });
      continue;
    }
    const target = surface.scripts.find(
      (entry) => entry.id === followup.script,
    );
    if (!target || target.id === script.id) continue;
    const question = fillTemplate(surface, context, target.question);
    if (question === null) continue;
    if (!resolveParts(surface, context, target)) continue;
    followups.push({ kind: "script", id: target.id, question });
  }
  return followups;
}

function resolveParts<C>(
  surface: Surface<C>,
  context: C,
  script: ClutchScript,
): ResolvedSegment[] | null {
  const segments: ResolvedSegment[] = [];
  for (const part of script.parts) {
    if ("text" in part) {
      segments.push({ text: part.text, code: null, tint: null });
      continue;
    }
    const value = surface.resolveSlot(context, part.slot);
    if (!value) return null;
    segments.push({
      text: value.text,
      code: part.tint ? value.code : null,
      tint: part.tint ?? null,
    });
  }
  return segments;
}

/** An unresolvable slot drops the whole script; a literal never reaches screen. */
export function resolveScript<C>(
  surface: Surface<C>,
  script: ClutchScript,
  context: C,
): ResolvedScript | null {
  const question = fillTemplate(surface, context, script.question);
  if (question === null) return null;

  const segments = resolveParts(surface, context, script);
  if (!segments) return null;

  const followups = resolveFollowups(surface, context, script);
  if (!followups) return null;

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
export function pickScript<C>(
  surface: Surface<C>,
  context: C,
  now: Date = new Date(),
): ResolvedScript | null {
  const { scripts } = surface;
  if (scripts.length === 0) return null;
  const offset = dayOfYear(now) % scripts.length;
  for (let i = 0; i < scripts.length; i++) {
    const resolved = resolveScript(
      surface,
      scripts[(offset + i) % scripts.length],
      context,
    );
    if (resolved) return resolved;
  }
  return null;
}
