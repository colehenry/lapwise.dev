"use client";

import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getDriverFlagEmoji } from "@/lib/flags";
import { type GameDriver, gameDriverSearchQuery } from "@/lib/queries/game";

type DriverSearchPanelProps = {
  columnLabel: string;
  disabled: boolean;
  loading: boolean;
  onSubmit: (driver: GameDriver) => Promise<boolean>;
  rowLabel: string;
  usedDriverSlugs: Set<string>;
};

export default function DriverSearchPanel({
  columnLabel,
  disabled,
  loading,
  onSubmit,
  rowLabel,
  usedDriverSlugs,
}: DriverSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<GameDriver | null>(null);
  const deferredQuery = useDeferredValue(query.trim());
  const search = useQuery(gameDriverSearchQuery(deferredQuery));

  const selectDriver = (driver: GameDriver) => {
    if (usedDriverSlugs.has(driver.driver_slug)) return;
    setSelectedDriver(driver);
    setQuery(driver.full_name);
  };

  const submit = async () => {
    if (!selectedDriver) return;
    if (await onSubmit(selectedDriver)) {
      setQuery("");
      setSelectedDriver(null);
    }
  };

  const showResults =
    deferredQuery.length >= 2 &&
    selectedDriver?.full_name !== query &&
    !disabled;

  return (
    <div className="relative">
      <label
        htmlFor="driver-game-search"
        className="font-mono text-[9px] font-bold uppercase tracking-widest text-purple-400"
      >
        {rowLabel} × {columnLabel}
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Input
            id="driver-game-search"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="driver-game-results"
            aria-expanded={showResults}
            autoComplete="off"
            disabled={disabled || loading}
            value={query}
            placeholder="Search any World Championship driver"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedDriver(null);
            }}
          />

          {showResults && (
            <div
              id="driver-game-results"
              className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-sm border border-border-primary bg-bg-elevated shadow-xl"
              role="listbox"
            >
              {search.isLoading && (
                <p className="px-3 py-4 text-sm text-text-muted">
                  Searching drivers…
                </p>
              )}
              {search.isError && (
                <p className="px-3 py-4 text-sm text-warning">
                  Driver search is unavailable.
                </p>
              )}
              {search.data?.drivers.map((driver) => {
                const used = usedDriverSlugs.has(driver.driver_slug);
                return (
                  <button
                    key={driver.driver_slug}
                    type="button"
                    role="option"
                    aria-selected={
                      selectedDriver?.driver_slug === driver.driver_slug
                    }
                    disabled={used}
                    onClick={() => selectDriver(driver)}
                    className="flex w-full items-center gap-3 border-b border-border-primary px-3 py-2.5 text-left last:border-b-0 hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <span className="text-lg" aria-hidden="true">
                      {getDriverFlagEmoji(driver.country_code) || "🏁"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-primary">
                        {driver.full_name}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
                        {driver.driver_code || driver.driver_slug}
                      </span>
                    </span>
                    {used && (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-warning">
                        Used
                      </span>
                    )}
                  </button>
                );
              })}
              {search.data?.drivers.length === 0 && (
                <p className="px-3 py-4 text-sm text-text-muted">
                  No matching race drivers.
                </p>
              )}
            </div>
          )}
        </div>
        <Button
          className="rounded-sm sm:min-w-32"
          disabled={!selectedDriver || disabled}
          isLoading={loading}
          onClick={submit}
        >
          Submit driver
        </Button>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        Type at least two characters, then choose a canonical driver record.
      </p>
    </div>
  );
}
