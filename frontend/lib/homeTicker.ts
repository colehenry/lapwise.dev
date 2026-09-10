import { puzzleDate } from "@/lib/puzzleSchedule";
import type { Headline } from "@/lib/queries/headlines";

/** Opens the lane. */
const PINNED_FIRST = "championship";
/** Closes it. */
const PINNED_LAST = "next_race";

/** Enough to read as a lane, few enough that one loop is not a chore. */
const TARGET_COUNT = 9;

/**
 * Headlines the lane does not carry, by id prefix. Selection is the client's
 * job (§5.3), so dropping one belongs here rather than in the service.
 */
const EXCLUDED_HEADLINES = ["last_race.fastest_lap"];

/**
 * Kickers the lane words differently from the service, by id prefix.
 *
 * This is copy, and copy is the service's to author. If this map grows past a
 * handful, move the wording into the headlines service instead of forking it
 * here.
 */
const KICKER_OVERRIDES: Record<string, string> = {
  "championship.driver_gap": "Championship gap",
  "next_race.up_next": "Next race",
};

function matches(id: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => id.startsWith(prefix));
}

/** Applies the lane's own wording, leaving every other field untouched. */
export function tickerCopy(headline: Headline): Headline {
  const key = Object.keys(KICKER_OVERRIDES).find((prefix) =>
    headline.id.startsWith(prefix),
  );
  return key ? { ...headline, kicker: KICKER_OVERRIDES[key] } : headline;
}

/** The order is stable across a re-render, so the lane never jumps. */
function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomiser(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(
  candidates: Headline[],
  next: () => number,
): Headline | null {
  if (candidates.length === 0) return null;
  const total = candidates.reduce(
    (sum, item) => sum + Math.max(0, item.weight),
    0,
  );
  if (total <= 0) return candidates[0];
  let target = next() * total;
  for (const candidate of candidates) {
    target -= Math.max(0, candidate.weight);
    if (target <= 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

function shuffle<T>(items: T[], next: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** The seed the lane is ordered by. Changes at the daily rollover, in UTC. */
export function tickerSeed(now: Date = new Date()): string {
  return puzzleDate(0, now);
}

/**
 * The pool is bigger than the lane. Pin the championship state first and the
 * next race last, take at most one headline per remaining category, and order
 * the middle with a daily seed.
 */
export function selectHeadlines(
  headlines: Headline[],
  seed: string,
  targetCount = TARGET_COUNT,
): Headline[] {
  const pool = headlines.filter(
    (headline) => !matches(headline.id, EXCLUDED_HEADLINES),
  );
  if (pool.length === 0) return [];
  const next = randomiser(seedFrom(seed));

  const byCategory = new Map<string, Headline[]>();
  for (const headline of pool) {
    const bucket = byCategory.get(headline.category);
    if (bucket) bucket.push(headline);
    else byCategory.set(headline.category, [headline]);
  }

  const first = pickWeighted(byCategory.get(PINNED_FIRST) ?? [], next);
  const last = pickWeighted(byCategory.get(PINNED_LAST) ?? [], next);

  const middle: Headline[] = [];
  for (const [category, candidates] of byCategory) {
    if (category === PINNED_FIRST || category === PINNED_LAST) continue;
    const chosen = pickWeighted(candidates, next);
    if (chosen) middle.push(chosen);
  }

  const pinnedCount = (first ? 1 : 0) + (last ? 1 : 0);
  const taken = shuffle(middle, next).slice(
    0,
    Math.max(0, targetCount - pinnedCount),
  );

  return [...(first ? [first] : []), ...taken, ...(last ? [last] : [])].map(
    tickerCopy,
  );
}

export type HeadlineSegment = { text: string; code: string | null };

/** Splits a headline's text on its entity tokens so each span can be tinted. */
export function headlineSegments(headline: Headline): HeadlineSegment[] {
  const tokens = [...headline.tokens].sort((a, b) => a.start - b.start);
  const segments: HeadlineSegment[] = [];
  let cursor = 0;
  for (const token of tokens) {
    if (token.start < cursor || token.end > headline.text.length) continue;
    if (token.start > cursor) {
      segments.push({
        text: headline.text.slice(cursor, token.start),
        code: null,
      });
    }
    segments.push({
      text: headline.text.slice(token.start, token.end),
      code: token.code,
    });
    cursor = token.end;
  }
  if (cursor < headline.text.length) {
    segments.push({ text: headline.text.slice(cursor), code: null });
  }
  return segments;
}
