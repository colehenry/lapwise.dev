"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { DiscussionEmbed } from "@/components/discussions/DiscussionEmbeds";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import MonoLabel from "@/components/ui/MonoLabel";
import { apiHeaders, apiUrl, fetchSeasons } from "@/lib/api";
import {
  DISCUSSION_EMBED_CATEGORIES,
  DISCUSSION_EMBEDS,
  type DiscussionEmbedCategory,
  type DiscussionEmbedDefinition,
} from "@/lib/discussionEmbedRegistry";
import type { RoundSummary, SessionResultsResponse } from "@/lib/types";

type SessionChoice = "race" | "sprint" | "qualifying" | "sprint-qualifying";

type PickOption = {
  key: string;
  label: string;
  meta?: string;
};

const viewOptions = [
  { value: "position", label: "Position" },
  { value: "gap", label: "Gap to Leader" },
  { value: "lapTime", label: "Lap Time" },
];

const pointsTypeOptions = [
  { value: "race", label: "Race Points" },
  { value: "qualifying", label: "Qualifying Points" },
];

const modeOptions = {
  "points-by-round": [
    { value: "drivers", label: "Drivers" },
    { value: "constructors", label: "Constructors" },
  ],
  "teammate-head-to-head": [
    { value: "race", label: "Race" },
    { value: "qualifying", label: "Qualifying" },
  ],
};

function selectClass(isActive: boolean) {
  return `rounded-sm border px-3 py-2 text-left text-xs transition-colors ${
    isActive
      ? "border-purple-500 bg-purple-500/15 text-purple-200"
      : "border-border-primary bg-bg-primary text-text-secondary hover:border-purple-500/60 hover:text-text-primary"
  }`;
}

function formatAttrValue(value: string): string {
  return /^[\w.-]+$/.test(value) ? value : `"${value.replaceAll('"', '\\"')}"`;
}

function buildDirective(
  embed: DiscussionEmbedDefinition,
  values: Record<string, string>,
): string {
  const attrs: Record<string, string> = {
    type: embed.id,
    season: values.season,
  };

  if (embed.needsRound) attrs.round = values.round;
  if (values.session === "sprint" || values.session === "sprint-qualifying") {
    attrs.isSprint = "true";
  }
  if (values.practiceSession) attrs.practiceSession = values.practiceSession;
  if (values.view) attrs.view = values.view;
  if (values.drivers) attrs.drivers = values.drivers;
  if (values.entities) attrs.entities = values.entities;
  if (values.mode) attrs.mode = values.mode;
  if (values.pointsType) attrs.pointsType = values.pointsType;
  if (values.limit) attrs.limit = values.limit;
  if (values.title) attrs.title = values.title;

  const attrString = Object.entries(attrs)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${formatAttrValue(value)}`)
    .join(" ");

  return `::${embed.kind}{${attrString}}`;
}

function toAttrs(
  embed: DiscussionEmbedDefinition,
  values: Record<string, string>,
) {
  return {
    type: embed.id,
    season: values.season,
    round: embed.needsRound ? values.round : undefined,
    isSprint:
      values.session === "sprint" || values.session === "sprint-qualifying"
        ? "true"
        : undefined,
    practiceSession: values.practiceSession,
    view: values.view,
    drivers: values.drivers,
    entities: values.entities,
    mode: values.mode,
    pointsType: values.pointsType,
    limit: values.limit,
    title: values.title,
  };
}

function getSessionOptions(embed: DiscussionEmbedDefinition): Array<{
  value: SessionChoice;
  label: string;
}> {
  if (embed.category === "qualifying") {
    return [
      { value: "qualifying", label: "Qualifying" },
      { value: "sprint-qualifying", label: "Sprint Qualifying" },
    ];
  }

  return [
    { value: "race", label: "Race" },
    { value: "sprint", label: "Sprint" },
  ];
}

async function fetchRounds(season: string): Promise<RoundSummary[]> {
  if (!season) return [];
  const res = await fetch(apiUrl(`/api/results/${season}`), {
    headers: apiHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const seen = new Set<number>();
  return ((data.rounds || []) as RoundSummary[]).filter((round) => {
    if (seen.has(round.round)) return false;
    seen.add(round.round);
    return true;
  });
}

async function fetchSessionDrivers(
  season: string,
  round: string,
  session: SessionChoice,
  practiceSession?: string,
) {
  if (!season || !round) return [];
  const suffix = practiceSession
    ? `/practice/${practiceSession}`
    : session === "race"
      ? ""
      : session === "sprint"
        ? "/sprint"
        : session === "qualifying"
          ? "/qualifying"
          : "/sprint-qualifying";
  const res = await fetch(apiUrl(`/api/results/${season}/${round}${suffix}`), {
    cache: "no-store",
    headers: apiHeaders(),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as SessionResultsResponse;
  return data.results
    .map((result) => ({
      code: result.driver.driver_code ?? result.driver.full_name,
      name: result.driver.full_name,
      position: result.position,
    }))
    .filter((driver) => !!driver.code);
}

async function fetchSeasonEntities(
  season: string,
  embedId: string,
  mode: string,
  pointsType: string,
): Promise<PickOption[]> {
  if (!season) return [];

  if (embedId === "teammate-head-to-head") {
    const res = await fetch(
      apiUrl(`/api/results/${season}/teammate-h2h?mode=${mode || "race"}`),
      { headers: apiHeaders() },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      teams?: Array<{ team_name: string; rounds_compared: number }>;
    };
    return (data.teams ?? [])
      .sort((a, b) => b.rounds_compared - a.rounds_compared)
      .map((team) => ({
        key: team.team_name,
        label: team.team_name,
        meta: `${team.rounds_compared} rounds`,
      }));
  }

  const entityMode = mode === "constructors" ? "constructors" : "drivers";
  const res = await fetch(
    apiUrl(
      `/api/results/${season}/points-progression?mode=${entityMode}&points_type=${pointsType || "race"}`,
    ),
    { headers: apiHeaders() },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    drivers?: Array<{
      driver_code: string;
      full_name: string;
      team_name?: string | null;
      final_position: number;
    }>;
    constructors?: Array<{ team_name: string; final_position: number }>;
  };

  if (entityMode === "constructors") {
    return (data.constructors ?? [])
      .sort((a, b) => a.final_position - b.final_position)
      .map((team) => ({
        key: team.team_name,
        label: team.team_name,
        meta: `P${team.final_position}`,
      }));
  }

  return (data.drivers ?? [])
    .sort((a, b) => a.final_position - b.final_position)
    .map((driver) => ({
      key: driver.driver_code,
      label: driver.full_name,
      meta: `P${driver.final_position}${driver.team_name ? ` · ${driver.team_name}` : ""}`,
    }));
}

export default function EmbedBuilder({
  onInsert,
}: {
  onInsert: (snippet: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<DiscussionEmbedCategory>("race");
  const [embedId, setEmbedId] = useState(DISCUSSION_EMBEDS[0]?.id ?? "");
  const [graphSearch, setGraphSearch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [entitySearch, setEntitySearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>({
    session: "race",
    view: "position",
    title: "Position Battle",
    practiceSession: "1",
    limit: "10",
  });

  const selectedEmbed = useMemo(
    () => DISCUSSION_EMBEDS.find((embed) => embed.id === embedId),
    [embedId],
  );

  const { data: seasons = [] } = useQuery<number[]>({
    queryKey: ["seasons"],
    queryFn: fetchSeasons,
    staleTime: 1000 * 60 * 60,
    enabled: open,
  });

  useEffect(() => {
    if (!open || seasons.length === 0 || values.season) return;
    setValues((current) => ({
      ...current,
      season: String(Math.max(...seasons)),
    }));
  }, [open, seasons, values.season]);

  const { data: rounds = [] } = useQuery<RoundSummary[]>({
    queryKey: ["embed-rounds", values.season],
    queryFn: () => fetchRounds(values.season),
    enabled: open && !!values.season,
    staleTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (!open || !selectedEmbed?.needsRound || rounds.length === 0) return;
    if (values.round && rounds.some((round) => String(round.round) === values.round)) {
      return;
    }
    setValues((current) => ({
      ...current,
      round: String(rounds[rounds.length - 1]?.round ?? ""),
    }));
  }, [open, rounds, selectedEmbed?.needsRound, values.round]);

  const sessionValue = (values.session || "race") as SessionChoice;
  const { data: drivers = [] } = useQuery({
    queryKey: [
      "embed-session-drivers",
      values.season,
      values.round,
      sessionValue,
      values.practiceSession,
      selectedEmbed?.id,
    ],
    queryFn: () =>
      fetchSessionDrivers(
        values.season,
        values.round,
        sessionValue,
        selectedEmbed?.controls.includes("practiceSession")
          ? values.practiceSession || "1"
          : undefined,
      ),
    enabled:
      open &&
      !!selectedEmbed?.controls.includes("drivers") &&
      !!values.season &&
      !!values.round,
    staleTime: 1000 * 60 * 15,
  });

  const { data: entities = [] } = useQuery({
    queryKey: [
      "embed-season-entities",
      values.season,
      embedId,
      values.mode,
      values.pointsType,
    ],
    queryFn: () =>
      fetchSeasonEntities(
        values.season,
        embedId,
        values.mode,
        values.pointsType,
      ),
    enabled:
      open &&
      !!selectedEmbed?.controls.includes("entities") &&
      !!values.season,
    staleTime: 1000 * 60 * 15,
  });

  const embeds = DISCUSSION_EMBEDS.filter((embed) => {
    if (embed.category !== category) return false;
    const q = graphSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      embed.label.toLowerCase().includes(q) ||
      embed.description.toLowerCase().includes(q)
    );
  });
  const needsRound = !!selectedEmbed?.needsRound;
  const canPreview =
    !!selectedEmbed && !!values.season && (!needsRound || !!values.round);
  const snippet = selectedEmbed ? buildDirective(selectedEmbed, values) : "";

  const updateValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const chooseEmbed = (embed: DiscussionEmbedDefinition) => {
    setEmbedId(embed.id);
    setValues((current) => ({
      ...current,
      drivers: "",
      entities: "",
      session: embed.category === "qualifying" ? "qualifying" : "race",
      ...embed.defaults,
    }));
    setDriverSearch("");
    setEntitySearch("");
  };

  const chooseCategory = (next: DiscussionEmbedCategory) => {
    setCategory(next);
    const first = DISCUSSION_EMBEDS.find((embed) => embed.category === next);
    if (first) chooseEmbed(first);
  };

  const toggleDriver = (code: string) => {
    const current = values.drivers ? values.drivers.split(",").filter(Boolean) : [];
    const next = current.includes(code)
      ? current.filter((item) => item !== code)
      : [...current, code];
    updateValue("drivers", next.join(","));
  };

  const toggleEntity = (key: string) => {
    const current = values.entities ? values.entities.split(",").filter(Boolean) : [];
    const next = current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key];
    updateValue("entities", next.join(","));
  };

  const selectedDrivers = values.drivers
    ? values.drivers.split(",").filter(Boolean)
    : [];
  const selectedEntities = values.entities
    ? values.entities.split(",").filter(Boolean)
    : [];
  const filteredDrivers = drivers.filter((driver) => {
    const q = driverSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      driver.code.toLowerCase().includes(q) ||
      driver.name.toLowerCase().includes(q)
    );
  });
  const filteredEntities = entities.filter((entity) => {
    const q = entitySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      entity.key.toLowerCase().includes(q) ||
      entity.label.toLowerCase().includes(q) ||
      (entity.meta ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="rounded-sm border border-border-primary bg-bg-tertiary/60 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <MonoLabel as="div">Lapwise Graphs</MonoLabel>
          <p className="mt-1 text-xs text-text-muted">
            Pick the graph, season, round, and options here.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Add graph
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-6">
          <div className="mx-auto max-w-6xl rounded-sm border border-border-primary bg-bg-secondary shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-primary px-4 py-3">
              <div>
                <h3 className="text-base font-bold text-text-primary">Add Lapwise graph</h3>
                <p className="mt-1 text-xs text-text-muted">
                  The post gets a clean embed. The preview uses the same renderer readers see.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm border border-border-primary px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-3">
                {DISCUSSION_EMBED_CATEGORIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => chooseCategory(item.id)}
                    className={`${selectClass(category === item.id)} w-full`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span>{item.label}</span>
                      <span className="text-[10px] text-text-muted">
                        {
                          DISCUSSION_EMBEDS.filter(
                            (embed) => embed.category === item.id,
                          ).length
                        }
                      </span>
                    </span>
                  </button>
                ))}
                <div className="rounded-sm border border-border-primary bg-bg-primary p-3">
                  <MonoLabel as="div">Selected</MonoLabel>
                  <p className="mt-1 text-xs text-text-muted">
                    {selectedEmbed?.label ?? "No graph"}
                  </p>
                  <p className="mt-2 text-[11px] text-text-muted">
                    {selectedDrivers.length > 0 &&
                      `${selectedDrivers.length} drivers`}
                    {selectedDrivers.length > 0 && selectedEntities.length > 0
                      ? " · "
                      : ""}
                    {selectedEntities.length > 0 &&
                      `${selectedEntities.length} selections`}
                    {selectedDrivers.length === 0 &&
                      selectedEntities.length === 0 &&
                      "Defaults until you pick names"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <MonoLabel as="div">Graph</MonoLabel>
                    <p className="mt-1 text-xs text-text-muted">
                      Choose the chart first, then narrow the field.
                    </p>
                  </div>
                  <Input
                    value={graphSearch}
                    onChange={(e) => setGraphSearch(e.target.value)}
                    placeholder="Search graphs"
                    className="w-full sm:w-64"
                  />
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {embeds.map((embed) => (
                    <button
                      key={embed.id}
                      type="button"
                      onClick={() => chooseEmbed(embed)}
                      className={selectClass(embed.id === embedId)}
                    >
                      <span className="block font-bold text-text-primary">{embed.label}</span>
                      <span className="mt-1 block text-[11px] leading-4 text-text-muted">
                        {embed.description}
                      </span>
                    </button>
                  ))}
                </div>

                {selectedEmbed && (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                      <MonoLabel as="span">Season</MonoLabel>
                      <select
                        value={values.season ?? ""}
                        onChange={(e) => {
                          updateValue("season", e.target.value);
                          updateValue("round", "");
                        }}
                        className="mt-1 w-full rounded-sm border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500"
                      >
                        <option value="" disabled>
                          Season
                        </option>
                        {seasons.map((season) => (
                          <option key={season} value={season}>
                            {season}
                          </option>
                        ))}
                      </select>
                    </label>

                    {needsRound && (
                      <label className="block">
                        <MonoLabel as="span">Round</MonoLabel>
                        <select
                          value={values.round ?? ""}
                          onChange={(e) => updateValue("round", e.target.value)}
                          className="mt-1 w-full rounded-sm border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500"
                        >
                          <option value="" disabled>
                            Round
                          </option>
                          {rounds.map((round) => (
                            <option key={round.round} value={round.round}>
                              R{String(round.round).padStart(2, "0")} - {round.event_name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {selectedEmbed.controls.includes("session") && (
                      <label className="block">
                        <MonoLabel as="span">Session</MonoLabel>
                        <select
                          value={values.session ?? "race"}
                          onChange={(e) => updateValue("session", e.target.value)}
                          className="mt-1 w-full rounded-sm border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500"
                        >
                          {getSessionOptions(selectedEmbed).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {selectedEmbed.controls.includes("practiceSession") && (
                      <label className="block">
                        <MonoLabel as="span">Practice</MonoLabel>
                        <select
                          value={values.practiceSession ?? "1"}
                          onChange={(e) => updateValue("practiceSession", e.target.value)}
                          className="mt-1 w-full rounded-sm border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500"
                        >
                          <option value="1">FP1</option>
                          <option value="2">FP2</option>
                          <option value="3">FP3</option>
                        </select>
                      </label>
                    )}

                    {selectedEmbed.controls.includes("view") && (
                      <label className="block">
                        <MonoLabel as="span">View</MonoLabel>
                        <select
                          value={values.view ?? "position"}
                          onChange={(e) => updateValue("view", e.target.value)}
                          className="mt-1 w-full rounded-sm border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500"
                        >
                          {viewOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {selectedEmbed.controls.includes("mode") && (
                      <label className="block">
                        <MonoLabel as="span">Mode</MonoLabel>
                        <select
                          value={values.mode ?? selectedEmbed.defaults?.mode ?? "race"}
                          onChange={(e) => updateValue("mode", e.target.value)}
                          className="mt-1 w-full rounded-sm border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500"
                        >
                          {(modeOptions[selectedEmbed.id as keyof typeof modeOptions] ?? []).map(
                            (option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    )}

                    {selectedEmbed.controls.includes("pointsType") && (
                      <label className="block">
                        <MonoLabel as="span">Points</MonoLabel>
                        <select
                          value={values.pointsType ?? "race"}
                          onChange={(e) => updateValue("pointsType", e.target.value)}
                          className="mt-1 w-full rounded-sm border border-border-primary bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500"
                        >
                          {pointsTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {selectedEmbed.controls.includes("limit") && (
                      <label className="block">
                        <MonoLabel as="span">Rows</MonoLabel>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={values.limit ?? "10"}
                          onChange={(e) => updateValue("limit", e.target.value)}
                          className="mt-1"
                        />
                      </label>
                    )}

                    {selectedEmbed.controls.includes("title") && (
                      <label className="block md:col-span-2">
                        <MonoLabel as="span">Title</MonoLabel>
                        <Input
                          value={values.title ?? ""}
                          onChange={(e) => updateValue("title", e.target.value)}
                          className="mt-1"
                          placeholder={selectedEmbed.label}
                        />
                      </label>
                    )}
                  </div>
                )}

                {selectedEmbed?.controls.includes("drivers") && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <MonoLabel as="div">Drivers</MonoLabel>
                        <p className="mt-1 text-xs text-text-muted">
                          {selectedDrivers.length > 0
                            ? `${selectedDrivers.length} selected`
                            : "Pick exact drivers or use a quick set."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateValue(
                              "drivers",
                              drivers
                                .slice(0, 3)
                                .map((driver) => driver.code)
                                .join(","),
                            )
                          }
                          className="rounded-sm border border-border-primary px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                        >
                          Top 3
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateValue(
                              "drivers",
                              drivers
                                .slice(0, 5)
                                .map((driver) => driver.code)
                                .join(","),
                            )
                          }
                          className="rounded-sm border border-border-primary px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                        >
                          Top 5
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateValue(
                              "drivers",
                              drivers
                                .slice(0, 10)
                                .map((driver) => driver.code)
                                .join(","),
                            )
                          }
                          className="rounded-sm border border-border-primary px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                        >
                          Top 10
                        </button>
                        <button
                          type="button"
                          onClick={() => updateValue("drivers", "")}
                          className="rounded-sm border border-border-primary px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <Input
                      value={driverSearch}
                      onChange={(e) => setDriverSearch(e.target.value)}
                      placeholder="Search drivers by code or name"
                      className="mb-2"
                    />
                    {selectedDrivers.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2 rounded-sm border border-border-primary bg-bg-primary p-2">
                        {selectedDrivers.map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => toggleDriver(code)}
                            className="rounded-sm border border-purple-500/60 bg-purple-500/15 px-2 py-1 text-[11px] text-purple-200"
                          >
                            {code} x
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="grid max-h-56 gap-2 overflow-y-auto rounded-sm border border-border-primary bg-bg-primary p-2 sm:grid-cols-2 lg:grid-cols-3">
                      {drivers.length > 0 ? (
                        filteredDrivers.map((driver) => {
                          const selected = selectedDrivers.includes(driver.code);
                          return (
                            <button
                              key={driver.code}
                              type="button"
                              onClick={() => toggleDriver(driver.code)}
                              className={selectClass(selected)}
                            >
                              <span className="block font-bold">
                                {driver.position ? `P${driver.position} ` : ""}
                                {driver.code}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                                {driver.name}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <p className="px-1 py-2 text-xs text-text-muted">
                          Choose a season and round to load drivers.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedEmbed?.controls.includes("entities") && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <MonoLabel as="div">
                          {values.mode === "constructors" ||
                          selectedEmbed.id === "teammate-head-to-head"
                            ? "Constructors"
                            : "Drivers"}
                        </MonoLabel>
                        <p className="mt-1 text-xs text-text-muted">
                          {selectedEntities.length > 0
                            ? `${selectedEntities.length} selected`
                            : "Pick the exact lines to show in the draft."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateValue(
                              "entities",
                              entities
                                .slice(0, 3)
                                .map((entity) => entity.key)
                                .join(","),
                            )
                          }
                          className="rounded-sm border border-border-primary px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                        >
                          Top 3
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateValue(
                              "entities",
                              entities
                                .slice(0, 6)
                                .map((entity) => entity.key)
                                .join(","),
                            )
                          }
                          className="rounded-sm border border-border-primary px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                        >
                          Top 6
                        </button>
                        <button
                          type="button"
                          onClick={() => updateValue("entities", "")}
                          className="rounded-sm border border-border-primary px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <Input
                      value={entitySearch}
                      onChange={(e) => setEntitySearch(e.target.value)}
                      placeholder="Search drivers or constructors"
                      className="mb-2"
                    />
                    {selectedEntities.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2 rounded-sm border border-border-primary bg-bg-primary p-2">
                        {selectedEntities.map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleEntity(key)}
                            className="rounded-sm border border-purple-500/60 bg-purple-500/15 px-2 py-1 text-[11px] text-purple-200"
                          >
                            {key} x
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="grid max-h-56 gap-2 overflow-y-auto rounded-sm border border-border-primary bg-bg-primary p-2 sm:grid-cols-2 lg:grid-cols-3">
                      {entities.length > 0 ? (
                        filteredEntities.map((entity) => {
                          const selected = selectedEntities.includes(entity.key);
                          return (
                            <button
                              key={entity.key}
                              type="button"
                              onClick={() => toggleEntity(entity.key)}
                              className={selectClass(selected)}
                            >
                              <span className="block font-bold">{entity.label}</span>
                              {entity.meta && (
                                <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                                  {entity.meta}
                                </span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <p className="px-1 py-2 text-xs text-text-muted">
                          Choose a season and mode to load options.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-sm border border-border-primary bg-bg-primary p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <MonoLabel as="div">Embed</MonoLabel>
                    <code className="break-all text-[11px] text-text-muted">{snippet}</code>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto">
                    {canPreview && selectedEmbed ? (
                      <DiscussionEmbed
                        kind={selectedEmbed.kind}
                        attrs={toAttrs(selectedEmbed, values)}
                      />
                    ) : (
                      <p className="py-8 text-center text-sm text-text-muted">
                        Pick the required season and round to preview.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      onInsert(snippet);
                      setOpen(false);
                    }}
                    disabled={!canPreview || !snippet}
                  >
                    Insert graph
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
