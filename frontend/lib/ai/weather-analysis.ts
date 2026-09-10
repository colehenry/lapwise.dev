import {
  type AnalysisPageContext,
  type AnalysisPlan,
  type AnswerArtifact,
  analysisPlanSchema,
  answerArtifactSchema,
} from "./analysis-contracts";
import { executeAIParamQuery } from "./db";
import { extractSeason } from "./question-parsing";
import {
  loadResultSessionCandidates,
  type ResultSessionCandidate,
  type ResultSessionType,
  selectResultSession,
} from "./session-result-analysis";

export const SESSION_WEATHER_SQL = `
  SELECT session_time_seconds, air_temp, track_temp, humidity,
         wind_speed, wind_direction, rainfall
  FROM weather_data
  WHERE session_id = $1
  ORDER BY session_time_seconds
`;

interface WeatherSample {
  airTemp: number | null;
  trackTemp: number | null;
  humidity: number | null;
  windSpeed: number | null;
  rainfall: boolean;
}

export interface WeatherAnalysisExecution {
  plan: AnalysisPlan;
  artifact: AnswerArtifact;
  queries: string[];
  model: string;
}

export function looksLikeWeatherAnalysis(question: string): boolean {
  return /\b(weather|rain|raining|rainfall|wet|dry|air temperature|track temperature|wind|humidity)\b/i.test(
    question,
  );
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return value !== null && value !== "" && Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseSample(row: Record<string, unknown>): WeatherSample {
  return {
    airTemp: numberOrNull(row.air_temp),
    trackTemp: numberOrNull(row.track_temp),
    humidity: numberOrNull(row.humidity),
    windSpeed: numberOrNull(row.wind_speed),
    rainfall:
      row.rainfall === true || String(row.rainfall).toLowerCase() === "true",
  };
}

function range(values: Array<number | null>): [number, number] | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length > 0
    ? [Math.min(...present), Math.max(...present)]
    : null;
}

export function buildWeatherAnalysisExecution(params: {
  question: string;
  season: number;
  sessionType: ResultSessionType;
  session: ResultSessionCandidate;
  samples: WeatherSample[];
}): WeatherAnalysisExecution {
  const { question, season, sessionType, session, samples } = params;
  const rainySamples = samples.filter((sample) => sample.rainfall).length;
  const airRange = range(samples.map((sample) => sample.airTemp));
  const trackRange = range(samples.map((sample) => sample.trackTemp));
  const evidenceId = `session-weather-${session.id}`;
  const summary =
    samples.length === 0
      ? `No weather samples are available for the ${season} ${session.eventName}, so Clutch cannot verify whether rain affected the session.`
      : rainySamples > 0
        ? `Rainfall was recorded in ${rainySamples} of ${samples.length} weather samples for the ${season} ${session.eventName}. This confirms recorded rain, but not its competitive effect without lap and strategy evidence.`
        : `None of the ${samples.length} available weather samples for the ${season} ${session.eventName} recorded rainfall.`;
  const plan = analysisPlanSchema.parse({
    version: 1,
    question,
    entities: [
      { kind: "event", id: session.id, name: session.eventName },
      { kind: "season", id: season, name: String(season) },
    ],
    scope: { season, rounds: [session.round], sessionTypes: [sessionType] },
    facets: [
      {
        family: "weather",
        objective: "Report recorded session weather and its coverage",
        metrics: ["rainfall_samples", "air_temperature", "track_temperature"],
        presentations: ["narrative", "metric_cards", "table"],
      },
    ],
    assumptions: [],
    unresolvedTerms: [],
  });
  const artifact = answerArtifactSchema.parse({
    version: 1,
    family: "weather",
    title: `${season} ${session.eventName} weather`,
    summary,
    metrics:
      samples.length > 0
        ? [
            {
              id: "rainfall-coverage",
              label: "Rainfall samples",
              value: rainySamples,
              displayValue: `${rainySamples} of ${samples.length}`,
              evidenceIds: [evidenceId],
            },
            ...(airRange
              ? [
                  {
                    id: "air-temperature",
                    label: "Air temperature",
                    value: `${airRange[0]}-${airRange[1]}`,
                    displayValue: `${airRange[0].toFixed(1)}–${airRange[1].toFixed(1)}°C`,
                    evidenceIds: [evidenceId],
                  },
                ]
              : []),
            ...(trackRange
              ? [
                  {
                    id: "track-temperature",
                    label: "Track temperature",
                    value: `${trackRange[0]}-${trackRange[1]}`,
                    displayValue: `${trackRange[0].toFixed(1)}–${trackRange[1].toFixed(1)}°C`,
                    evidenceIds: [evidenceId],
                  },
                ]
              : []),
          ]
        : [],
    tables:
      samples.length > 0
        ? [
            {
              id: "weather-coverage",
              title: "Weather coverage",
              columns: [
                { key: "samples", label: "Samples" },
                { key: "rain", label: "Rain" },
                { key: "air", label: "Air temperature" },
                { key: "track", label: "Track temperature" },
              ],
              rows: [
                {
                  samples: samples.length,
                  rain: `${rainySamples} (${((rainySamples / samples.length) * 100).toFixed(1)}%)`,
                  air: airRange
                    ? `${airRange[0].toFixed(1)}–${airRange[1].toFixed(1)}°C`
                    : "—",
                  track: trackRange
                    ? `${trackRange[0].toFixed(1)}–${trackRange[1].toFixed(1)}°C`
                    : "—",
                },
              ],
            },
          ]
        : [],
    charts: [],
    evidence: [
      {
        id: evidenceId,
        kind: "database",
        label: "Session weather samples",
        source: "weather_data",
        fields: {
          sessionId: session.id,
          sampleCount: samples.length,
          rainySamples,
        },
      },
    ],
    caveats:
      samples.length === 0
        ? ["Weather coverage is unavailable for this session."]
        : [
            "Weather samples describe recorded conditions; causal race-impact claims require lap and strategy evidence.",
          ],
    actions: [
      {
        label: `Open ${session.eventName}`,
        href: `/results/${season}/${session.round}${sessionType === "sprint_race" ? "?tab=sprint" : ""}`,
      },
    ],
  });
  return {
    plan,
    artifact,
    queries: [SESSION_WEATHER_SQL.trim()],
    model: "deterministic/weather-v1",
  };
}

export async function tryRunWeatherAnalysis(
  question: string,
  pageContext?: AnalysisPageContext,
): Promise<WeatherAnalysisExecution | null> {
  const season = extractSeason(question) ?? pageContext?.season ?? null;
  if (season === null || !looksLikeWeatherAnalysis(question)) return null;
  const sessionType: ResultSessionType =
    pageContext?.sessionType === "sprint_race" || /\bsprint\b/i.test(question)
      ? "sprint_race"
      : "race";
  const candidates = await loadResultSessionCandidates(season, sessionType);
  const session = selectResultSession(question, candidates, pageContext);
  if (!session) return null;
  const rows = await executeAIParamQuery(SESSION_WEATHER_SQL, [session.id]);
  return buildWeatherAnalysisExecution({
    question,
    season,
    sessionType,
    session,
    samples: rows.map(parseSample),
  });
}
