export type DiscussionEmbedKind = "lapwise-chart" | "lapwise-table";

export type DiscussionEmbedCategory =
  | "race"
  | "strategy"
  | "qualifying"
  | "practice"
  | "season"
  | "tables";

export type DiscussionEmbedControl =
  | "drivers"
  | "entities"
  | "view"
  | "session"
  | "practiceSession"
  | "pointsType"
  | "mode"
  | "limit"
  | "title";

export type DiscussionEmbedDefinition = {
  id: string;
  label: string;
  category: DiscussionEmbedCategory;
  kind: DiscussionEmbedKind;
  description: string;
  needsRound: boolean;
  controls: DiscussionEmbedControl[];
  defaults?: Record<string, string>;
};

export const DISCUSSION_EMBED_CATEGORIES: Array<{
  id: DiscussionEmbedCategory;
  label: string;
}> = [
  { id: "race", label: "Race" },
  { id: "strategy", label: "Strategy" },
  { id: "qualifying", label: "Qualifying" },
  { id: "practice", label: "Practice" },
  { id: "season", label: "Season" },
  { id: "tables", label: "Tables" },
];

export const DISCUSSION_EMBEDS: DiscussionEmbedDefinition[] = [
  {
    id: "position-battle",
    label: "Position Battle",
    category: "race",
    kind: "lapwise-chart",
    description: "Selected drivers by position, gap, or lap time.",
    needsRound: true,
    controls: ["session", "drivers", "view", "title"],
    defaults: { view: "position", title: "Position Battle" },
  },
  {
    id: "lap-time-by-lap",
    label: "Lap Time by Lap",
    category: "race",
    kind: "lapwise-chart",
    description: "Lap-by-lap pace for selected drivers.",
    needsRound: true,
    controls: ["session", "drivers", "view", "title"],
    defaults: { view: "lapTime", title: "Lap Time by Lap" },
  },
  {
    id: "race-pace-evolution",
    label: "Race Pace Evolution",
    category: "race",
    kind: "lapwise-chart",
    description: "How pace changed over a race stint window.",
    needsRound: true,
    controls: ["title"],
    defaults: { title: "Race Pace Evolution" },
  },
  {
    id: "fastest-lap-timeline",
    label: "Fastest Lap Timeline",
    category: "race",
    kind: "lapwise-chart",
    description: "Every time the session fastest lap changed hands.",
    needsRound: true,
    controls: ["session", "title"],
    defaults: { title: "Fastest Lap Timeline" },
  },
  {
    id: "lap-time-distribution",
    label: "Lap Time Distribution",
    category: "race",
    kind: "lapwise-chart",
    description: "Clean-lap distributions for the race.",
    needsRound: true,
    controls: ["title"],
    defaults: { title: "Lap Time Distribution" },
  },
  {
    id: "weather",
    label: "Weather",
    category: "race",
    kind: "lapwise-chart",
    description: "Track temperature, air temperature, humidity, and rain.",
    needsRound: true,
    controls: ["title"],
    defaults: { title: "Weather" },
  },
  {
    id: "pit-stop-delta",
    label: "Pit Stop Delta",
    category: "strategy",
    kind: "lapwise-chart",
    description: "Pit stop time loss and gain across the field.",
    needsRound: true,
    controls: ["session", "title"],
    defaults: { title: "Pit Stop Delta" },
  },
  {
    id: "tyre-stints",
    label: "Tyre Stints",
    category: "strategy",
    kind: "lapwise-chart",
    description: "Compound usage and stint lengths by driver.",
    needsRound: true,
    controls: ["session", "drivers", "title"],
    defaults: { title: "Tyre Stints" },
  },
  {
    id: "tyre-degradation",
    label: "Tyre Degradation",
    category: "strategy",
    kind: "lapwise-chart",
    description: "Compound falloff and relative degradation trends.",
    needsRound: true,
    controls: ["session", "drivers", "title"],
    defaults: { title: "Tyre Degradation" },
  },
  {
    id: "speed-trap",
    label: "Speed Trap",
    category: "strategy",
    kind: "lapwise-chart",
    description: "Maximum speed by timing trap.",
    needsRound: true,
    controls: ["session", "title"],
    defaults: { title: "Speed Trap" },
  },
  {
    id: "qualifying-progression",
    label: "Qualifying Progression",
    category: "qualifying",
    kind: "lapwise-chart",
    description: "Q1, Q2, and Q3 progression in one view.",
    needsRound: true,
    controls: ["session", "title"],
    defaults: { title: "Qualifying Progression" },
  },
  {
    id: "qualifying-sector-heatmap",
    label: "Qualifying Sector Heatmap",
    category: "qualifying",
    kind: "lapwise-chart",
    description: "Best sectors and composite laps across qualifying.",
    needsRound: true,
    controls: ["title"],
    defaults: { title: "Qualifying Sector Heatmap" },
  },
  {
    id: "qualifying-sector-comparison",
    label: "Qualifying Sector Comparison",
    category: "qualifying",
    kind: "lapwise-chart",
    description: "Compare two drivers sector by sector.",
    needsRound: true,
    controls: ["title"],
    defaults: { title: "Qualifying Sector Comparison" },
  },
  {
    id: "long-run-pace",
    label: "Long Run Pace",
    category: "practice",
    kind: "lapwise-chart",
    description: "Practice stint pace ranges by compound.",
    needsRound: true,
    controls: ["practiceSession", "drivers", "title"],
    defaults: { practiceSession: "1", title: "Long Run Pace" },
  },
  {
    id: "track-evolution",
    label: "Track Evolution",
    category: "practice",
    kind: "lapwise-chart",
    description: "Lap time trend as the practice session evolves.",
    needsRound: true,
    controls: ["practiceSession", "drivers", "title"],
    defaults: { practiceSession: "1", title: "Track Evolution" },
  },
  {
    id: "tyre-programme",
    label: "Tyre Programme",
    category: "practice",
    kind: "lapwise-chart",
    description: "Practice tyre usage by driver and compound.",
    needsRound: true,
    controls: ["practiceSession", "drivers", "title"],
    defaults: { practiceSession: "1", title: "Tyre Programme" },
  },
  {
    id: "practice-sector-heatmap",
    label: "Practice Sector Heatmap",
    category: "practice",
    kind: "lapwise-chart",
    description: "Best practice sectors and composite laps.",
    needsRound: true,
    controls: ["practiceSession", "drivers", "title"],
    defaults: { practiceSession: "1", title: "Practice Sector Heatmap" },
  },
  {
    id: "points-by-round",
    label: "Points by Round",
    category: "season",
    kind: "lapwise-chart",
    description: "Driver or constructor points progression.",
    needsRound: false,
    controls: ["mode", "pointsType", "entities", "title"],
    defaults: { mode: "drivers", pointsType: "race", title: "Points by Round" },
  },
  {
    id: "teammate-head-to-head",
    label: "Teammate Head-to-Head",
    category: "season",
    kind: "lapwise-chart",
    description: "Teammate comparison across a season.",
    needsRound: false,
    controls: ["mode", "entities", "title"],
    defaults: { mode: "race", title: "Teammate Head-to-Head" },
  },
  {
    id: "race-results",
    label: "Race Results",
    category: "tables",
    kind: "lapwise-table",
    description: "Classified race result table.",
    needsRound: true,
    controls: ["limit", "title"],
    defaults: { limit: "10", title: "Race Results" },
  },
  {
    id: "qualifying-results",
    label: "Qualifying Results",
    category: "tables",
    kind: "lapwise-table",
    description: "Qualifying result table.",
    needsRound: true,
    controls: ["limit", "title"],
    defaults: { limit: "10", title: "Qualifying Results" },
  },
  {
    id: "sprint-results",
    label: "Sprint Results",
    category: "tables",
    kind: "lapwise-table",
    description: "Sprint result table.",
    needsRound: true,
    controls: ["limit", "title"],
    defaults: { limit: "10", title: "Sprint Results" },
  },
  {
    id: "sprint-qualifying-results",
    label: "Sprint Qualifying Results",
    category: "tables",
    kind: "lapwise-table",
    description: "Sprint qualifying result table.",
    needsRound: true,
    controls: ["limit", "title"],
    defaults: { limit: "10", title: "Sprint Qualifying Results" },
  },
];

export function getDiscussionEmbed(id: string | undefined) {
  return DISCUSSION_EMBEDS.find((embed) => embed.id === id);
}
