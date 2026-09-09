/**
 * Renders frozen category evidence into a line of proof.
 *
 * Boards store resolved facts rather than sentences, so wording can change
 * without rewriting a snapshot and a career total cannot drift under a
 * completed board. A kind with no formatter returns null, which leaves the
 * caller with the satisfied/unsatisfied result alone.
 */

import { getCountryName } from "@/lib/flags";

export type CategoryEvidence = {
  kind: string;
  satisfied: boolean;
} & Record<string, unknown>;

type RaceRef = { year: number; event: string };

function raceRef(value: unknown): RaceRef | null {
  if (!value || typeof value !== "object") return null;
  const ref = value as Partial<RaceRef>;
  return typeof ref.year === "number" && typeof ref.event === "string"
    ? { year: ref.year, event: ref.event }
    : null;
}

function race(value: unknown): string {
  const ref = raceRef(value);
  return ref ? `${ref.year} ${ref.event}` : "";
}

function spans(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((span) =>
      Array.isArray(span) && span[0] === span[1]
        ? `${span[0]}`
        : `${(span as number[])[0]}–${(span as number[])[1]}`,
    )
    .join(", ");
}

function count(
  value: unknown,
  singular: string,
  plural = `${singular}s`,
): string {
  const total = typeof value === "number" ? value : 0;
  return `${total} ${total === 1 ? singular : plural}`;
}

function entries(value: unknown): string {
  return count(value, "entry", "entries");
}

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];
}

type EvidenceFormatter = (evidence: CategoryEvidence) => string | null;

/** A Map rather than an object: `kind` arrives from the server, and a plain
 *  object would resolve "constructor" and "toString" to inherited members. */
const FORMATTER_TABLE: Record<string, EvidenceFormatter> = {
  // Annotated because `constructor` collides with Object.prototype and loses
  // its contextual type.
  constructor: (evidence: CategoryEvidence) => {
    const name = String(evidence.constructor ?? "");
    if (evidence.satisfied) {
      return `${name} ${spans(evidence.spans)} · ${entries(evidence.entries)}`;
    }
    const drove = list(evidence.drove_for);
    return drove.length > 0
      ? `Never at ${name} · drove for ${drove.join(", ")}`
      : `Never at ${name}`;
  },

  nationality: (evidence) => {
    const code = evidence.country_code;
    return typeof code === "string"
      ? getCountryName(code)
      : "Nationality unknown";
  },

  race_decade: (evidence) => {
    if (evidence.satisfied) {
      return `Raced ${evidence.first_year}–${evidence.last_year} · ${entries(evidence.entries)}`;
    }
    return evidence.career_first
      ? `Raced ${evidence.career_first}–${evidence.career_last}`
      : "No race entries";
  },

  debut_decade: (evidence) =>
    evidence.debut_year
      ? `Debut ${evidence.debut_year} ${evidence.debut_event}`
      : "No race entries",

  race_entries: (evidence) => {
    const total = entries(evidence.entries);
    return evidence.first_year
      ? `${total}, ${evidence.first_year}–${evidence.last_year}`
      : total;
  },

  race_winner: (evidence) => {
    if (evidence.satisfied) {
      return `${count(evidence.wins, "win")} · first ${race(evidence.first_win)}`;
    }
    const best = evidence.best_finish;
    return typeof best === "number"
      ? `No wins · best finish P${best} at ${race(evidence.best_finish_race)}`
      : "No race wins";
  },

  podium: (evidence) => {
    if (evidence.satisfied) {
      return `${count(evidence.podiums, "podium")} · first ${race(evidence.first_podium)}`;
    }
    const best = evidence.best_finish;
    return typeof best === "number"
      ? `No podiums · best finish P${best}`
      : "No podiums";
  },

  win_from_grid: (evidence) => {
    if (evidence.satisfied) {
      return `Won from P${evidence.grid} · ${race(evidence.race)}`;
    }
    // The nearest miss is the number a cross cannot carry.
    return typeof evidence.best_grid === "number"
      ? `Best win from P${evidence.best_grid} · ${race(evidence.race)}`
      : "No race wins";
  },

  sprint_winner: (evidence) => {
    if (evidence.satisfied) {
      return `${count(evidence.sprint_wins, "sprint win")} · first ${race(evidence.first_win)}`;
    }
    const started = evidence.sprint_entries;
    return typeof started === "number" && started > 0
      ? `No sprint wins in ${count(started, "sprint")}`
      : "Never started a sprint";
  },

  multi_constructor_winner: (evidence) => {
    const wins = Array.isArray(evidence.won_for) ? evidence.won_for : [];
    if (wins.length === 0) return "No race wins";
    const rendered = wins
      .map((win) => {
        const entry = win as { constructor?: string; year?: number };
        return `${entry.constructor} (${entry.year})`;
      })
      .join(", ");
    return evidence.satisfied
      ? `Won for ${rendered}`
      : `Won only for ${rendered}`;
  },

  named_teammate: (evidence) => {
    const teammate = String(evidence.teammate ?? "");
    if (evidence.satisfied) {
      const constructors = list(evidence.constructors).join(", ");
      return `Teammates at ${constructors} · ${spans(evidence.spans)}`;
    }
    if (evidence.self_reference) return `Is ${teammate}`;
    return `Never teammates with ${teammate}`;
  },
};

const FORMATTERS = new Map<string, EvidenceFormatter>(
  Object.entries(FORMATTER_TABLE),
);

/** A line of proof for one header, or null when the kind has no formatter. */
export function formatEvidence(
  evidence: CategoryEvidence | null | undefined,
): string | null {
  if (!evidence) return null;
  const formatter = FORMATTERS.get(evidence.kind);
  if (!formatter) return null;
  try {
    return formatter(evidence);
  } catch {
    return null;
  }
}
