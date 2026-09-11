"use client";

import { useMemo, useRef, useState } from "react";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import { findGameDrivers } from "@/lib/dailyGridDriverSearch";
import { getDriverHeadshotUrl } from "@/lib/entityImageOverrides";
import type {
  GameDriver,
  GameDriverCatalogItem,
} from "@/lib/queries/dailyGrid";

export default function DailyGameDriverSearch({
  catalog = [],
  disabled = false,
  excluded = new Set<string>(),
  loading = false,
  onSelect,
  placeholder = "Type a guess here...",
}: {
  catalog?: GameDriverCatalogItem[];
  disabled?: boolean;
  excluded?: Set<string>;
  loading?: boolean;
  onSelect: (driver: GameDriver) => unknown | Promise<unknown>;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const matches = useMemo(
    () => findGameDrivers(catalog, query, excluded),
    [catalog, excluded, query],
  );
  const open = query.trim().length > 0 && !disabled;
  const choose = async (driver: GameDriver) => {
    await onSelect(driver);
    setQuery("");
    setActive(0);
    input.current?.focus();
  };
  return (
    <div className="relative w-full">
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label="Search for a driver"
        aria-autocomplete="list"
        aria-controls="daily-game-driver-results"
        aria-expanded={open && matches.length > 0}
        autoComplete="off"
        disabled={disabled || loading}
        value={query}
        placeholder={loading ? "Submitting..." : placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (!open || matches.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((value) => (value + 1) % matches.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((value) => (value - 1 + matches.length) % matches.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            void choose(matches[active]);
          } else if (event.key === "Escape") {
            setQuery("");
          }
        }}
        className="h-[42px] w-full rounded-full border border-[var(--game-search-border)] bg-[var(--game-search-bg)] px-4 pr-11 text-[15px] text-[var(--game-search-ink)] outline-none placeholder:text-[var(--game-search-placeholder)] focus:border-accent-bright focus:shadow-[var(--shadow-purple)] disabled:opacity-55"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-[15px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 rounded-full border-[1.5px] border-[var(--game-search-icon)] after:absolute after:-bottom-[3px] after:-right-1 after:h-[1.5px] after:w-[5px] after:rotate-45 after:bg-[var(--game-search-icon)] after:content-['']"
      />
      {open && (
        <div
          id="daily-game-driver-results"
          role="listbox"
          className="absolute inset-x-0 top-[47px] z-[70] max-h-80 overflow-y-auto rounded-lg border border-line-strong bg-surface-band shadow-[var(--shadow-floating)]"
        >
          {matches.map((driver, index) => (
            <button
              key={driver.driver_slug}
              type="button"
              role="option"
              aria-selected={index === active}
              onPointerMove={() => setActive(index)}
              onClick={() => void choose(driver)}
              className={`flex w-full items-center gap-3 border-b border-line-soft px-[13px] py-2.5 text-left last:border-0 focus:outline-none ${
                index === active ? "bg-line-soft" : "bg-transparent"
              }`}
            >
              <DriverHeadshot
                code={driver.driver_code}
                fullName={driver.full_name}
                size={36}
                shape="circle"
                src={getDriverHeadshotUrl(driver)}
                focalX={driver.media?.focal_x}
                focalY={driver.media?.focal_y}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-base">
                {driver.full_name}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                {driver.driver_code}
              </span>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="px-[13px] py-3 text-sm text-ink-faint">
              No matching drivers.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
