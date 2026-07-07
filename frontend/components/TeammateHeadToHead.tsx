"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { apiHeaders, apiUrl, isValidHeadshotUrl } from "@/lib/api";

const DEFAULT_SHOWN = 6;

interface TeammateHeadToHeadProps {
  season: string;
  mode?: "race" | "qualifying";
  initialTeams?: string[];
}

type DriverInfo = {
  code: string | null;
  full_name: string;
  headshot_url: string | null;
  wins: number;
};

type TeamH2H = {
  team_name: string;
  team_color: string | null;
  logo_url: string | null;
  driver_a: DriverInfo;
  driver_b: DriverInfo;
  rounds_compared: number;
};

type H2HResponse = {
  year: number;
  teams: TeamH2H[];
};

function DriverAvatar({
  driver,
  color,
  side,
  winsLabel = "W",
}: {
  driver: DriverInfo;
  color: string;
  side: "left" | "right";
  winsLabel?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 ${side === "right" ? "flex-row-reverse" : ""}`}
    >
      {isValidHeadshotUrl(driver.headshot_url) ? (
        <Image
          src={driver.headshot_url as string}
          alt={driver.full_name}
          width={32}
          height={32}
          className="rounded-sm object-cover border border-border-secondary flex-shrink-0"
        />
      ) : (
        <div
          className="w-8 h-8 rounded-sm flex items-center justify-center text-[10px] font-bold font-mono flex-shrink-0"
          style={{
            backgroundColor: `${color}22`,
            borderLeft: side === "left" ? `2px solid ${color}` : undefined,
            borderRight: side === "right" ? `2px solid ${color}` : undefined,
            color,
          }}
        >
          {(driver.code ?? driver.full_name.slice(0, 3))
            .slice(0, 3)
            .toUpperCase()}
        </div>
      )}
      <div className={side === "right" ? "text-right" : ""}>
        <p className="text-xs font-bold font-mono" style={{ color }}>
          {driver.code ?? driver.full_name.split(" ").pop()}
        </p>
        <p className="text-[10px] text-text-muted font-mono">
          {driver.wins}
          {winsLabel}
        </p>
      </div>
    </div>
  );
}

export default function TeammateHeadToHead({
  season,
  mode = "race",
  initialTeams,
}: TeammateHeadToHeadProps) {
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initialTeamKey = initialTeams?.join(",") ?? "";

  const { data, isLoading } = useQuery<H2HResponse | null>({
    queryKey: ["teammate-h2h", season, mode],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/results/${season}/teammate-h2h?mode=${mode}`),
        { cache: "no-store", headers: apiHeaders() },
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!season,
  });

  useEffect(() => {
    if (!data?.teams) return;
    const sorted = [...data.teams].sort(
      (a, b) => b.rounds_compared - a.rounds_compared,
    );
    const available = new Set(sorted.map((t) => t.team_name));
    const requested = initialTeamKey
      .split(",")
      .filter((team) => available.has(team));
    setSelectedTeams(
      requested.length > 0
        ? requested
        : sorted.slice(0, DEFAULT_SHOWN).map((t) => t.team_name),
    );
  }, [data, initialTeamKey]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {["a", "b", "c", "d", "e", "f"].map((id) => (
          <div
            key={`skel-h2h-${id}`}
            className="h-14 bg-bg-elevated rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!data || data.teams.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted text-sm font-mono">
          No race data available.
        </p>
      </div>
    );
  }

  const sorted = [...data.teams].sort(
    (a, b) => b.rounds_compared - a.rounds_compared,
  );
  const displayed = sorted.filter((t) => selectedTeams.includes(t.team_name));

  const toggleTeam = (name: string) => {
    setSelectedTeams((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  return (
    <div className="space-y-3">
      {/* Selector row */}
      <div className="flex items-center justify-between" ref={dropdownRef}>
        <p className="text-xs font-bold font-mono text-text-secondary uppercase tracking-widest">
          Head to Head {mode === "qualifying" ? "Qualifying" : "Race"} Results
        </p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDropdown((v) => !v)}
            className="px-3 py-1.5 rounded-sm text-xs font-bold font-mono uppercase tracking-widest border border-border-secondary text-text-secondary hover:border-purple-500 hover:text-purple-300 transition-colors duration-150"
          >
            Constructors ({selectedTeams.length})
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-border-primary rounded-sm shadow-xl z-10 min-w-[220px] max-h-[300px] overflow-y-auto">
              {sorted.map((team) => {
                const color = team.team_color
                  ? `#${team.team_color}`
                  : "var(--series-1)";
                const checked = selectedTeams.includes(team.team_name);
                return (
                  <label
                    key={team.team_name}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-bg-elevated cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTeam(team.team_name)}
                      className="w-4 h-4 accent-purple-500"
                    />
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span
                      className="text-sm font-semibold font-mono"
                      style={{ color }}
                    >
                      {team.team_name}
                    </span>
                    <span className="text-[10px] text-text-muted font-mono ml-auto">
                      {team.rounds_compared}R
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Team cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {displayed.map((team) => {
          const color = team.team_color
            ? `#${team.team_color}`
            : "var(--series-1)";
          const winsLabel = mode === "qualifying" ? "Q" : "W";

          // Winner (more wins) always on left
          const [driverLeft, driverRight] =
            team.driver_b.wins > team.driver_a.wins
              ? [team.driver_b, team.driver_a]
              : [team.driver_a, team.driver_b];

          const total = driverLeft.wins + driverRight.wins;
          const leftPct = Math.round(
            (total > 0 ? driverLeft.wins / total : 0.5) * 100,
          );
          const rightPct = 100 - leftPct;

          return (
            <div
              key={team.team_name}
              className="bg-bg-primary/40 border border-border-primary/60 rounded-sm p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] font-bold font-mono uppercase tracking-widest"
                  style={{ color }}
                >
                  {team.team_name}
                </span>
                <span className="text-[9px] text-text-muted font-mono">
                  {team.rounds_compared}{" "}
                  {mode === "qualifying" ? "sessions" : "races"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <DriverAvatar
                  driver={driverLeft}
                  color={color}
                  side="left"
                  winsLabel={winsLabel}
                />

                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center h-5 rounded-sm overflow-hidden bg-bg-elevated/60">
                    <div
                      className="h-full flex items-center justify-end pr-2 transition-all duration-500"
                      style={{
                        width: `${leftPct}%`,
                        backgroundColor: `${color}55`,
                        borderRight: `2px solid ${color}`,
                        minWidth: leftPct > 0 ? "2px" : 0,
                      }}
                    >
                      {leftPct >= 20 && (
                        <span
                          className="text-[10px] font-bold font-mono"
                          style={{ color }}
                        >
                          {leftPct}%
                        </span>
                      )}
                    </div>
                    <div
                      className="h-full flex items-center justify-start pl-2 transition-all duration-500"
                      style={{
                        width: `${rightPct}%`,
                        backgroundColor: `${color}28`,
                        minWidth: rightPct > 0 ? "2px" : 0,
                      }}
                    >
                      {rightPct >= 20 && (
                        <span className="text-[10px] font-bold font-mono text-text-muted">
                          {rightPct}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-center">
                    <span
                      className="text-base font-bold font-mono"
                      style={{ color }}
                    >
                      {driverLeft.wins}
                    </span>
                    <span className="text-text-muted font-mono text-xs mx-1.5">
                      –
                    </span>
                    <span className="text-base font-bold font-mono text-text-secondary">
                      {driverRight.wins}
                    </span>
                  </div>
                </div>

                <DriverAvatar
                  driver={driverRight}
                  color={color}
                  side="right"
                  winsLabel={winsLabel}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
