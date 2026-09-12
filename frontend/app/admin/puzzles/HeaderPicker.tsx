"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PuzzleHeaderOption } from "@/lib/queries/adminGrid";

const KIND_LABELS: Record<string, string> = {
  constructor: "Constructor",
  nationality: "Nationality",
  won_at_venue: "Won at venue",
  named_teammate: "Teammate of",
  race_decade: "Raced in decade",
  debut_decade: "Debuted in decade",
  race_winner: "Race winner",
  podium: "Podium finisher",
  race_entries: "Race entries",
  world_champion: "World champion",
  win_from_grid: "Won from the back",
  multi_constructor_winner: "Won with 2+ constructors",
  sprint_winner: "Sprint winner",
  defunct_venue: "Raced at a defunct venue",
  pole_sitter: "Pole sitter",
};

export function kindLabel(kind: string) {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, " ");
}

/** Picks one header from the catalog.
 *
 *  Grouped by kind rather than listed flat: venue headers alone outnumber
 *  every other kind, so a flat list is a scroll rather than a choice. Typing
 *  flattens the groups so a search spans all of them. */
/** Fewest answers this header would leave in any cell against the headers
 *  already placed on the other axis; null when that axis is still empty. */
export function minCellDepth(
  option: PuzzleHeaderOption,
  against: PuzzleHeaderOption[],
): number | null {
  if (against.length === 0) return null;
  const own = new Set(option.answers);
  return Math.min(
    ...against.map(
      (other) => other.answers.filter((slug) => own.has(slug)).length,
    ),
  );
}

export default function HeaderPicker({
  headers,
  taken,
  against = [],
  onPick,
  onClose,
}: {
  headers: PuzzleHeaderOption[];
  /** Ids already on the board; shown but not pickable. */
  taken: Set<string>;
  /** Headers on the crossing axis. An option that would empty a cell against
   *  any of them is left out; the count shown is its thinnest cell. */
  against?: PuzzleHeaderOption[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openKind, setOpenKind] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    input.current?.focus();
    const away = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", onEscape);
    };
  }, [onClose]);

  const depths = useMemo(
    () =>
      new Map(
        headers.map((header) => [header.id, minCellDepth(header, against)]),
      ),
    [headers, against],
  );

  const byKind = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const matching = headers.filter(
      (header) =>
        depths.get(header.id) !== 0 &&
        (!lowered || header.label.toLowerCase().includes(lowered)),
    );
    const groups = new Map<string, PuzzleHeaderOption[]>();
    for (const header of matching) {
      groups.set(header.kind, [...(groups.get(header.kind) ?? []), header]);
    }
    // Biggest groups first: the kinds with the most options are the ones a
    // board is usually built from.
    return [...groups.entries()].sort(
      (a, b) =>
        b[1].length - a[1].length ||
        kindLabel(a[0]).localeCompare(kindLabel(b[0])),
    );
  }, [headers, query, depths]);

  const searching = query.trim().length > 0;

  return (
    <div
      ref={root}
      className="absolute left-0 top-full z-40 mt-1 w-72 rounded-sm border border-line-soft bg-surface-raised shadow-xl"
    >
      <input
        ref={input}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={
          against.length
            ? "Search headers that still cross"
            : `Search ${headers.length} headers`
        }
        className="w-full border-b border-line-soft bg-transparent px-3 py-2 text-sm text-ink-strong outline-none"
      />
      <div className="max-h-80 overflow-y-auto">
        {byKind.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-ink-faint">
            No header matches.
          </p>
        )}
        {byKind.map(([kind, options]) => {
          const open = searching || openKind === kind;
          return (
            <div
              key={kind}
              className="border-b border-line-soft last:border-b-0"
            >
              {!searching && (
                <button
                  type="button"
                  onClick={() => setOpenKind(open ? null : kind)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-surface-panel"
                >
                  <span className="text-xs font-medium text-ink-base">
                    {kindLabel(kind)}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint">
                    {options.length}
                  </span>
                </button>
              )}
              {open && (
                <ul className={searching ? "" : "bg-surface-page"}>
                  {options.map((option) => {
                    const used = taken.has(option.id);
                    const thinnest = depths.get(option.id) ?? null;
                    return (
                      <li key={option.id}>
                        <button
                          type="button"
                          disabled={used}
                          onClick={() => onPick(option.id)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-1 text-left text-xs text-ink-strong hover:bg-surface-panel disabled:cursor-not-allowed disabled:text-ink-faint"
                        >
                          <span className="truncate">
                            {option.label}
                            {searching && (
                              <span className="ml-1.5 text-[10px] text-ink-faint">
                                {kindLabel(kind)}
                              </span>
                            )}
                          </span>
                          {/* Thinnest cell once the crossing axis has headers;
                              the header's own depth before that. */}
                          <span
                            className={`shrink-0 font-mono text-[10px] ${
                              thinnest !== null && thinnest < 3
                                ? "text-amber-400"
                                : "text-ink-faint"
                            }`}
                          >
                            {used
                              ? "on board"
                              : thinnest === null
                                ? option.depth
                                : `min ${thinnest}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
