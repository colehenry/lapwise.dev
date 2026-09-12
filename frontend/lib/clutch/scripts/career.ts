import type {
  ClutchScript,
  SlotValue,
  Surface,
  SurfaceDigest,
} from "@/lib/clutch/script";
import { teamTint } from "@/lib/consoleFormat";
import type {
  ConstructorProfile,
  DriverProfile,
  DriverSuperlative,
} from "@/lib/types";

/**
 * A driver's or a constructor's career, in the one shape the scripts read.
 * The pages build it from their profile responses with the helpers below.
 */
export type CareerContext = {
  entity: "driver" | "constructor";
  name: string;
  /** Route and tint key: the driver code or the constructor slug. */
  code: string;
  color: string | undefined;
  seasons: number;
  races: number;
  championships: number;
  wins: number;
  podiums: number;
  /** Driver pages carry the superlatives strip; constructors have none. */
  superlatives: DriverSuperlative[];
};

const SCRIPTS: ClutchScript[] = [
  {
    id: "record",
    question: "What does the career add up to?",
    parts: [
      { slot: "name", tint: "driver" },
      { text: " has " },
      { slot: "wins" },
      { text: " wins and " },
      { slot: "podiums" },
      { text: " podiums from " },
      { slot: "races" },
      { text: " races over " },
      { slot: "seasons" },
      { text: " seasons, " },
      { slot: "championships.phrase" },
      { text: "." },
    ],
    followups: [
      { script: "best-circuit" },
      { script: "strike-rate" },
      { ask: "What stands out about {name}'s career?" },
    ],
  },
  {
    id: "strike-rate",
    question: "How often did a podium become a win?",
    parts: [
      { slot: "wins" },
      { text: " of the " },
      { slot: "podiums" },
      { text: " podiums were wins, so " },
      { slot: "winRate" },
      { text: " of " },
      { slot: "races" },
      { text: " starts ended in victory." },
    ],
    followups: [
      { script: "record" },
      { ask: "Which of {name}'s wins were the hardest earned?" },
    ],
  },
  {
    id: "best-circuit",
    question: "Where did the wins come most often?",
    parts: [
      { slot: "circuit.wins" },
      { text: " of the " },
      { slot: "wins" },
      { text: " wins came at the " },
      { slot: "circuit.event" },
      { text: "." },
    ],
    followups: [
      { script: "wins-rank" },
      { ask: "Why was {name} so strong at the {circuit.event}?" },
    ],
  },
  {
    id: "wins-rank",
    question: "Where do the wins rank all-time?",
    parts: [
      { slot: "wins" },
      { text: " wins ranks " },
      { slot: "name", tint: "driver" },
      { text: " " },
      { slot: "wins.rank" },
      { text: " in Formula 1 history." },
    ],
    followups: [
      { script: "record" },
      { ask: "Who is closest to {name} on the all-time wins list?" },
    ],
  },
];

function plain(value: string | number | null | undefined): SlotValue | null {
  return value == null || value === ""
    ? null
    : { text: String(value), code: null };
}

function championshipsPhrase(context: CareerContext): string {
  const noun =
    context.entity === "driver"
      ? "world championship"
      : "constructors' championship";
  if (context.championships === 0) return `without a ${noun}`;
  if (context.championships === 1) return `with one ${noun}`;
  return `with ${context.championships} ${noun}s`;
}

/* The superlatives strip labels a circuit fact "Wins at {event}" and ranks
   the win count "#N all-time" or "all-time leader"; the slots read those. */
function circuitSlot(context: CareerContext, field: string): SlotValue | null {
  const fact = context.superlatives.find((item) => item.id === "circuit_wins");
  if (!fact) return null;
  if (field === "wins") return plain(fact.value);
  if (field === "event") return plain(fact.label.replace(/^Wins at /, ""));
  return null;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

function winsRank(context: CareerContext): SlotValue | null {
  const fact = context.superlatives.find((item) => item.id === "wins");
  if (!fact?.sublabel) return null;
  if (fact.sublabel === "all-time leader") return plain("first");
  const rank = /^#(\d+) all-time$/.exec(fact.sublabel);
  return rank ? plain(ordinal(Number(rank[1]))) : null;
}

function resolveSlot(context: CareerContext, slot: string): SlotValue | null {
  if (slot === "name") {
    return {
      text: context.name,
      code: context.code,
      color: context.color,
      tint: context.entity === "driver" ? "driver" : "team",
    };
  }
  if (slot === "seasons") return plain(context.seasons || null);
  if (slot === "races") return plain(context.races || null);
  if (slot === "wins") return plain(context.wins);
  if (slot === "podiums") return plain(context.podiums || null);
  if (slot === "winRate") {
    if (context.races === 0) return null;
    return plain(`${Math.round((context.wins / context.races) * 100)}%`);
  }
  if (slot === "championships.phrase")
    return plain(championshipsPhrase(context));
  if (slot.startsWith("circuit.")) return circuitSlot(context, slot.slice(8));
  if (slot === "wins.rank") return winsRank(context);
  return null;
}

function digest(context: CareerContext): SurfaceDigest | null {
  return {
    kind: "career",
    entity: context.entity,
    slug: context.code,
    seasons: context.seasons,
    wins: context.wins,
    championships: context.championships,
  };
}

export const CAREER_SURFACE: Surface<CareerContext> = {
  scripts: SCRIPTS,
  resolveSlot,
  digest,
};

export function driverCareer(
  profile: DriverProfile,
  superlatives: DriverSuperlative[] = [],
): CareerContext {
  return {
    entity: "driver",
    name: profile.full_name,
    code: profile.driver_code ?? profile.driver_slug ?? profile.full_name,
    color: teamTint(profile.current_team_color),
    seasons: profile.total_seasons,
    races: profile.total_races,
    championships: profile.total_championships,
    wins: profile.total_wins,
    podiums: profile.total_podiums,
    superlatives,
  };
}

export function constructorCareer(profile: ConstructorProfile): CareerContext {
  return {
    entity: "constructor",
    name: profile.team_name,
    code: profile.constructor_slug ?? profile.team_name,
    color: teamTint(profile.team_color),
    seasons: profile.total_seasons,
    races: profile.total_races,
    championships: profile.total_championships,
    wins: profile.total_wins,
    podiums: profile.total_podiums,
    superlatives: [],
  };
}
