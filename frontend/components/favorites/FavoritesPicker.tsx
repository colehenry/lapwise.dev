"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import TrackMapImage from "@/components/TrackMapImage";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { apiHeaders, apiUrl, isValidHeadshotUrl } from "@/lib/api";
import type {
  CircuitInfo,
  ConstructorListItem,
  DriverListItem,
} from "@/lib/types";

type Step = "team" | "driver" | "circuit";

const STEPS: Step[] = ["team", "driver", "circuit"];
const STEP_LABELS: Record<Step, string> = {
  team: "Favorite Team",
  driver: "Favorite Driver",
  circuit: "Favorite Circuit",
};

interface FavoritesPickerProps {
  open: boolean;
  onClose: () => void;
  onSave: (favorites: {
    favorite_driver_slug: string | null;
    favorite_team_name: string | null;
    favorite_circuit_id: number | null;
  }) => void;
  initialDriverSlug?: string | null;
  initialTeamName?: string | null;
  initialCircuitId?: number | null;
  isSaving?: boolean;
}

export default function FavoritesPicker({
  open,
  onClose,
  onSave,
  initialDriverSlug = null,
  initialTeamName = null,
  initialCircuitId = null,
  isSaving = false,
}: FavoritesPickerProps) {
  const [step, setStep] = useState<Step>("team");
  const [search, setSearch] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(
    initialTeamName,
  );
  const [selectedDriverSlug, setSelectedDriverSlug] = useState<string | null>(
    initialDriverSlug,
  );
  const [selectedCircuitId, setSelectedCircuitId] = useState<number | null>(
    initialCircuitId,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset search when step changes
  useEffect(() => {
    setSearch("");
  }, [step]);

  useEffect(() => {
    if (open) {
      setStep("team");
      setSearch("");
      setSelectedTeam(initialTeamName);
      setSelectedDriverSlug(initialDriverSlug);
      setSelectedCircuitId(initialCircuitId);
    }
  }, [open, initialTeamName, initialDriverSlug, initialCircuitId]);

  const { data: constructors, isLoading: loadingTeams } = useQuery<{
    constructors: ConstructorListItem[];
  }>({
    queryKey: ["constructors-list"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/constructors/"), {
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch constructors");
      return res.json();
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: drivers, isLoading: loadingDrivers } = useQuery<{
    drivers: DriverListItem[];
  }>({
    queryKey: ["drivers-list"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/drivers/"), {
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch drivers");
      return res.json();
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: circuits, isLoading: loadingCircuits } = useQuery<{
    circuits: CircuitInfo[];
  }>({
    queryKey: ["circuits-list"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/circuits/"), {
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch circuits");
      return res.json();
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const currentYear = new Date().getFullYear();

  const filteredTeams = useMemo(() => {
    if (!constructors?.constructors) return [];
    let list = constructors.constructors;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.team_name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const aCurrent = a.latest_season === currentYear ? 1 : 0;
      const bCurrent = b.latest_season === currentYear ? 1 : 0;
      if (aCurrent !== bCurrent) return bCurrent - aCurrent;
      return b.total_wins - a.total_wins;
    });
  }, [constructors, search, currentYear]);

  const filteredDrivers = useMemo(() => {
    if (!drivers?.drivers) return [];
    let list = drivers.drivers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.full_name.toLowerCase().includes(q) ||
          d.driver_code?.toLowerCase().includes(q) ||
          d.current_team?.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const aCurrent = a.latest_season === currentYear ? 1 : 0;
      const bCurrent = b.latest_season === currentYear ? 1 : 0;
      if (aCurrent !== bCurrent) return bCurrent - aCurrent;
      return b.total_wins - a.total_wins;
    });
  }, [drivers, search, currentYear]);

  const filteredCircuits = useMemo(() => {
    if (!circuits?.circuits) return [];
    let list = circuits.circuits;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.country.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q),
      );
    }
    return list;
  }, [circuits, search]);

  const stepIndex = STEPS.indexOf(step);

  function handleSkip() {
    if (step === "team") setSelectedTeam(null);
    else if (step === "driver") setSelectedDriverSlug(null);
    else if (step === "circuit") setSelectedCircuitId(null);

    if (stepIndex < STEPS.length - 1) {
      setStep(STEPS[stepIndex + 1]);
    } else {
      onSave({
        favorite_driver_slug: step === "driver" ? null : selectedDriverSlug,
        favorite_team_name: step === "team" ? null : selectedTeam,
        favorite_circuit_id: step === "circuit" ? null : selectedCircuitId,
      });
    }
  }

  function handleNext() {
    if (stepIndex < STEPS.length - 1) {
      setStep(STEPS[stepIndex + 1]);
    } else {
      onSave({
        favorite_driver_slug: selectedDriverSlug,
        favorite_team_name: selectedTeam,
        favorite_circuit_id: selectedCircuitId,
      });
    }
  }

  function handleBack() {
    if (stepIndex > 0) {
      setStep(STEPS[stepIndex - 1]);
    }
  }

  if (!open) return null;

  const isLoading =
    (step === "team" && loadingTeams) ||
    (step === "driver" && loadingDrivers) ||
    (step === "circuit" && loadingCircuits);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm border-none cursor-default"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        aria-label="Close modal"
      />
      <div className="relative w-full max-w-2xl max-h-[90vh] mx-4 sm:mx-auto bg-bg-secondary border border-border-primary rounded-sm flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary">
          <div>
            <p className="text-text-muted text-xs mb-1">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
            <h2 className="text-lg font-bold text-text-primary">
              {STEP_LABELS[step]}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors p-1"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <title>Close</title>
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1 px-5 pt-3">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? "bg-purple-500" : "bg-bg-elevated"
              }`}
            />
          ))}
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${step}s...`}
            className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-primary rounded-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={`skel-${step}-${
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                    i
                  }`}
                  variant="rectangular"
                  width="100%"
                  height="80px"
                />
              ))}
            </div>
          ) : step === "team" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
              {filteredTeams.map((team) => (
                <TeamCard
                  key={team.team_name}
                  team={team}
                  selected={selectedTeam === team.team_name}
                  onSelect={() =>
                    setSelectedTeam(
                      selectedTeam === team.team_name ? null : team.team_name,
                    )
                  }
                />
              ))}
              {filteredTeams.length === 0 && (
                <p className="col-span-full text-text-muted text-sm text-center py-8">
                  No teams found
                </p>
              )}
            </div>
          ) : step === "driver" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
              {filteredDrivers.map((driver) => {
                const slug = driver.driver_slug ?? driver.full_name;
                return (
                  <DriverCard
                    key={slug}
                    driver={driver}
                    selected={selectedDriverSlug === slug}
                    onSelect={() =>
                      setSelectedDriverSlug(
                        selectedDriverSlug === slug ? null : slug,
                      )
                    }
                  />
                );
              })}
              {filteredDrivers.length === 0 && (
                <p className="col-span-full text-text-muted text-sm text-center py-8">
                  No drivers found
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {filteredCircuits.map((circuit) => (
                <CircuitCard
                  key={circuit.id}
                  circuit={circuit}
                  selected={selectedCircuitId === circuit.id}
                  onSelect={() =>
                    setSelectedCircuitId(
                      selectedCircuitId === circuit.id ? null : circuit.id,
                    )
                  }
                />
              ))}
              {filteredCircuits.length === 0 && (
                <p className="text-text-muted text-sm text-center py-8">
                  No circuits found
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border-primary">
          <div>
            {stepIndex > 0 ? (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                Back
              </Button>
            ) : (
              <div />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={isSaving}
            >
              Skip
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleNext}
              disabled={isSaving}
              isLoading={stepIndex === STEPS.length - 1 && isSaving}
            >
              {stepIndex === STEPS.length - 1 ? "Save" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamCard({
  team,
  selected,
  onSelect,
}: {
  team: ConstructorListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const borderColor = team.team_color
    ? `#${team.team_color}`
    : "var(--border-primary)";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-sm border-2 transition-all text-left ${
        selected
          ? "border-purple-500 bg-purple-500/10"
          : "border-border-primary bg-bg-tertiary hover:border-border-secondary"
      }`}
    >
      {selected && <CheckBadge />}
      <div
        className="w-8 h-1 rounded-full"
        style={{ backgroundColor: borderColor }}
      />
      {team.logo_url && (
        // biome-ignore lint/performance/noImgElement: external logo URL
        <img
          src={team.logo_url}
          alt={team.team_name}
          className="w-10 h-10 object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      <span className="text-sm font-medium text-text-primary text-center leading-tight">
        {team.team_name}
      </span>
      <span className="text-xs text-text-muted">{team.total_wins} wins</span>
    </button>
  );
}

function DriverCard({
  driver,
  selected,
  onSelect,
}: {
  driver: DriverListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-sm border-2 transition-all text-left ${
        selected
          ? "border-purple-500 bg-purple-500/10"
          : "border-border-primary bg-bg-tertiary hover:border-border-secondary"
      }`}
    >
      {selected && <CheckBadge />}
      {isValidHeadshotUrl(driver.headshot_url) ? (
        // biome-ignore lint/performance/noImgElement: external headshot URL
        <img
          src={driver.headshot_url}
          alt={driver.full_name}
          className="w-12 h-12 rounded-full object-cover bg-bg-elevated"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-bg-elevated flex items-center justify-center text-text-muted text-sm font-mono">
          {driver.driver_code ?? driver.full_name.slice(0, 3).toUpperCase()}
        </div>
      )}
      <span className="text-sm font-medium text-text-primary text-center leading-tight">
        {driver.full_name}
      </span>
      {driver.current_team && (
        <span
          className="text-xs text-center leading-tight"
          style={{
            color: driver.current_team_color
              ? `#${driver.current_team_color}`
              : "var(--text-muted)",
          }}
        >
          {driver.current_team}
        </span>
      )}
    </button>
  );
}

function CircuitCard({
  circuit,
  selected,
  onSelect,
}: {
  circuit: CircuitInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full flex items-center gap-4 px-4 py-3 rounded-sm border-2 transition-all text-left ${
        selected
          ? "border-purple-500 bg-purple-500/10"
          : "border-border-primary bg-bg-tertiary hover:border-border-secondary"
      }`}
    >
      <TrackMapImage
        circuitId={circuit.id}
        circuitName={circuit.name}
        width={48}
        height={48}
        className="w-12 h-12 object-contain opacity-60 shrink-0"
        fallbackClassName="h-12 w-12 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">
          {circuit.name}
        </p>
        <p className="text-xs text-text-muted truncate">
          {circuit.location}, {circuit.country}
        </p>
      </div>
      <div className="text-xs text-text-muted shrink-0">
        {circuit.total_races} races
      </div>
      {selected && <CheckBadge />}
    </button>
  );
}

function CheckBadge() {
  return (
    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        stroke="white"
        strokeWidth="2"
      >
        <title>Selected</title>
        <path d="M2 6l3 3 5-5" />
      </svg>
    </div>
  );
}
