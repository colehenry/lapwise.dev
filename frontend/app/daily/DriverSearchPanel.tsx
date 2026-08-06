"use client";

import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import { Input } from "@/components/ui/Input";
import { findGameDrivers } from "@/lib/dailyGridDriverSearch";
import { getDriverHeadshotUrl } from "@/lib/entityImageOverrides";
import {
  type GameDriver,
  type GameDriverCatalogItem,
  gameDriverSearchQuery,
} from "@/lib/queries/dailyGrid";

type DriverSearchPanelProps = {
  catalog?: GameDriverCatalogItem[];
  catalogError: boolean;
  catalogLoading: boolean;
  columnLabel: string;
  loading: boolean;
  misses: GameDriver[];
  onClose: () => void;
  onSubmit: (driver: GameDriver) => Promise<boolean>;
  placedDriverSlugs: Set<string>;
  rowLabel: string;
};

export default function DriverSearchPanel({
  catalog,
  catalogError,
  catalogLoading,
  columnLabel,
  loading,
  misses,
  onClose,
  onSubmit,
  placedDriverSlugs,
  rowLabel,
}: DriverSearchPanelProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = query.trim();
  const deferredQuery = useDeferredValue(normalizedQuery);
  const fallbackSearch = useQuery({
    ...gameDriverSearchQuery(deferredQuery),
    enabled: catalogError && deferredQuery.length >= 2,
  });
  const availableDrivers = catalog
    ? findGameDrivers(catalog, query, placedDriverSlugs)
    : (fallbackSearch.data?.drivers ?? [])
        .filter((driver) => !placedDriverSlugs.has(driver.driver_slug))
        .slice(0, 12);
  const searching = catalogLoading || fallbackSearch.isLoading;
  const searchError = catalogError && fallbackSearch.isError;

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target)
      ) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onClose]);

  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 z-[60] flex justify-center sm:inset-x-5 sm:top-3">
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby="driver-search-title"
        className="pointer-events-auto relative z-10 w-full max-w-md rounded-lg border border-border-secondary bg-bg-secondary/95 p-4 shadow-2xl sm:p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="driver-search-title"
              className="text-sm font-bold text-text-primary sm:text-base"
            >
              {rowLabel} <span className="mx-1 text-text-muted">•</span>{" "}
              {columnLabel}
            </h2>
            {misses.length > 0 && (
              <p className="mt-1 truncate text-[10px] text-text-muted">
                Previous:{" "}
                {misses.map((miss) => `not ${miss.full_name}`).join(" · ")}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
          >
            ×
          </button>
        </div>

        <Input
          ref={inputRef}
          id="driver-game-search"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="driver-game-results"
          aria-expanded={normalizedQuery.length >= 2}
          autoComplete="off"
          disabled={loading}
          value={query}
          placeholder="Search drivers"
          className="mt-4"
          onChange={(event) => setQuery(event.target.value)}
        />

        {normalizedQuery.length >= 2 && (
          <div
            id="driver-game-results"
            className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border-primary bg-bg-primary"
            role="listbox"
          >
            {(searching || loading) && (
              <p className="px-3 py-4 text-sm text-text-muted">Searching…</p>
            )}
            {searchError && (
              <p className="px-3 py-4 text-sm text-red-400">
                Driver search is unavailable.
              </p>
            )}
            {!loading &&
              availableDrivers.map((driver) => (
                <button
                  key={driver.driver_slug}
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => onSubmit(driver)}
                  className="flex w-full items-center gap-3 border-b border-border-primary px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-bg-tertiary focus-visible:bg-bg-tertiary focus-visible:outline-none"
                >
                  <DriverHeadshot
                    code={driver.driver_code}
                    fullName={driver.full_name}
                    size={44}
                    src={getDriverHeadshotUrl(driver)}
                    focalX={driver.media?.focal_x}
                    focalY={driver.media?.focal_y}
                    className="rounded-md"
                  />
                  <span className="truncate text-sm font-semibold text-text-primary">
                    {driver.full_name}
                  </span>
                </button>
              ))}
            {!searching &&
              !searchError &&
              !loading &&
              availableDrivers.length === 0 && (
                <p className="px-3 py-4 text-sm text-text-muted">
                  No matching drivers.
                </p>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
