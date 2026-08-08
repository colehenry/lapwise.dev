"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAdminPuzzleHeaders } from "@/lib/admin";
import type { PuzzleHeaderOption } from "@/lib/adminTypes";

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

function kindLabel(kind: string) {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, " ");
}

/** Picks the headers a themed run must place on every board it covers.
 *
 *  Grouped by kind rather than listed flat: venue headers alone outnumber
 *  every other kind, so a flat list of sixty-four is a scroll rather than a
 *  choice. */
export default function ThemeHeaderPicker({
  floor,
  selected,
  onChange,
}: {
  floor: number;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [headers, setHeaders] = useState<PuzzleHeaderOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openKind, setOpenKind] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchAdminPuzzleHeaders(floor)
      .then((data) => {
        if (!cancelled) setHeaders(data.headers);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [floor]);

  const byKind = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const matching = lowered
      ? headers.filter((header) => header.label.toLowerCase().includes(lowered))
      : headers;
    const groups = new Map<string, PuzzleHeaderOption[]>();
    for (const header of matching) {
      groups.set(header.kind, [...(groups.get(header.kind) ?? []), header]);
    }
    return [...groups.entries()].sort((a, b) =>
      kindLabel(a[0]).localeCompare(kindLabel(b[0])),
    );
  }, [headers, query]);

  const labelFor = (id: string) =>
    headers.find((header) => header.id === id)?.label ?? id;

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.length === 0 ? (
          <span className="text-[11px] text-text-muted">
            No theme — the generator picks freely.
          </span>
        ) : (
          selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="flex items-center gap-1 rounded-sm border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[11px] text-text-primary hover:border-red-500/40 hover:bg-red-500/10"
            >
              {labelFor(id)}
              <span aria-hidden="true" className="text-text-muted">
                ×
              </span>
              <span className="sr-only">Remove</span>
            </button>
          ))
        )}
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={
          loading ? "Loading headers…" : `Search ${headers.length} headers`
        }
        disabled={loading || headers.length === 0}
        className="w-full rounded-sm border border-border-primary bg-bg-primary px-2 py-1 text-xs text-text-primary"
      />

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <div className="max-h-56 overflow-y-auto rounded-sm border border-border-primary">
        {byKind.map(([kind, options]) => {
          const open = openKind === kind || query.trim().length > 0;
          const chosen = options.filter((option) =>
            selected.includes(option.id),
          ).length;
          return (
            <div
              key={kind}
              className="border-b border-border-primary last:border-b-0"
            >
              <button
                type="button"
                onClick={() => setOpenKind(open && !query ? null : kind)}
                className="flex w-full items-center justify-between px-2 py-1.5 text-left hover:bg-bg-tertiary"
              >
                <span className="text-[11px] font-medium text-text-secondary">
                  {kindLabel(kind)}
                </span>
                <span className="font-mono text-[10px] text-text-muted">
                  {chosen > 0 && (
                    <span className="text-purple-300">{chosen} · </span>
                  )}
                  {options.length}
                </span>
              </button>
              {open && (
                <ul className="border-t border-border-primary/60 bg-bg-primary">
                  {options.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        onClick={() => toggle(option.id)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-1 text-left text-[11px] hover:bg-bg-tertiary ${
                          selected.includes(option.id)
                            ? "text-purple-300"
                            : "text-text-primary"
                        }`}
                      >
                        <span className="truncate">{option.label}</span>
                        <span className="shrink-0 font-mono text-[10px] text-text-muted">
                          {option.depth}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] leading-relaxed text-text-muted">
        A themed header is placed on every board the run covers, and the
        no-repeat window blocks it afterwards — so a three-day theme needs three
        headers. The number beside each is its depth: how many eligible drivers
        it accepts on its own.
      </p>
    </div>
  );
}
