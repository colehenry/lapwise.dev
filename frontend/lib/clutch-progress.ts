export type ClutchProgressStage =
  | "starting"
  | "planning"
  | "event"
  | "results"
  | "season"
  | "comparison"
  | "qualifying"
  | "race"
  | "strategy"
  | "weather"
  | "telemetry"
  | "more_data"
  | "chart"
  | "rules"
  | "finalizing";

export interface ClutchProgressMetric {
  value: number;
  label: string;
}

export interface ClutchProgressStatus {
  stage: ClutchProgressStage;
  metrics?: ClutchProgressMetric[];
}

const PROGRESS_MESSAGES: Record<ClutchProgressStage, readonly string[]> = {
  starting: [
    "Warming up the tyres...",
    "Leaving the garage...",
    "Firing up the timing screens...",
    "Getting the pit wall ready...",
  ],
  planning: [
    "Planning the overtake...",
    "Picking the racing line...",
    "Looking for clean air...",
    "Calling the strategy...",
  ],
  event: [
    "Finding the right race weekend...",
    "Rolling onto the grid...",
    "Checking the session board...",
    "Lining up on the right grid...",
  ],
  results: [
    "Reading the timing tower...",
    "Following the chequered flag...",
    "Sorting out the finishing order...",
    "Reviewing the classified results...",
  ],
  season: [
    "Following the title fight...",
    "Counting up the points...",
    "Tracing the championship momentum...",
    "Reading the championship picture...",
  ],
  comparison: [
    "Going wheel-to-wheel...",
    "Lining up the head-to-head...",
    "Checking the teammate battle...",
    "Looking for the competitive edge...",
  ],
  qualifying: [
    "Chasing purple sectors...",
    "Comparing the flying laps...",
    "Finding the pole margin...",
    "Clearing the track for a push lap...",
  ],
  race: [
    "Replaying the race lap by lap...",
    "Tracking the leaders...",
    "Looking for the turning point...",
    "Following the position changes...",
  ],
  strategy: [
    "Opening the pit window...",
    "Comparing tyre stints...",
    "Looking for the undercut...",
    "Pitting for more data...",
  ],
  weather: [
    "Checking the radar...",
    "Watching the clouds at Turn 1...",
    "Reading the track conditions...",
    "Looking for the crossover...",
  ],
  telemetry: [
    "Deploying energy...",
    "Harvesting energy...",
    "Opening the telemetry traces...",
    "Following the pace...",
  ],
  more_data: [
    "Pitting for more data...",
    "Checking the timing sheets...",
    "Taking another look at the monitors...",
    "Putting on a fresh set of numbers...",
  ],
  chart: [
    "Painting the pace picture...",
    "Plotting the title fight...",
    "Putting it on the timing screen...",
    "Drawing the racing lines...",
  ],
  rules: [
    "Checking with the stewards...",
    "Opening the rulebook...",
    "Reviewing the race director's notes...",
    "Checking what's allowed...",
  ],
  finalizing: [
    "Chequered flag in sight...",
    "Bringing it home...",
    "Final lap...",
    "Getting the answer over the line...",
  ],
};

export function pickClutchProgressMessage(
  stage: ClutchProgressStage,
  used: ReadonlySet<string>,
  random: () => number = Math.random,
): string {
  const pool = PROGRESS_MESSAGES[stage];
  const available = pool.filter((message) => !used.has(message));
  const choices = available.length > 0 ? available : pool;
  return choices[Math.floor(random() * choices.length)] ?? pool[0];
}

export function formatClutchProgressMetrics(
  metrics?: ClutchProgressMetric[],
): string | null {
  if (!metrics || metrics.length === 0) return null;
  return metrics
    .filter((metric) => Number.isFinite(metric.value) && metric.value >= 0)
    .slice(0, 3)
    .map((metric) => `${metric.value.toLocaleString()} ${metric.label}`)
    .join(" · ");
}

export function idleProgressStage(
  current: ClutchProgressStage,
): ClutchProgressStage {
  return current === "starting" ? "planning" : current;
}

export const CLUTCH_PROGRESS_MIN_VISIBLE_MS = 2_200;
export const CLUTCH_PROGRESS_IDLE_ROTATION_MS = 3_600;
