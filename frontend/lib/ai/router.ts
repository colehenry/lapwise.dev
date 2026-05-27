import { inferPromptIntent, type PromptIntent } from "./system-prompt";

export interface AIRoutingDecision {
  intent: PromptIntent;
  confidence: number;
  source: "deterministic" | "groq" | "fallback";
  requiredTools: string[];
  needsLapEvidence: boolean;
  needsRaceControl: boolean;
  needsWeather: boolean;
  needsStandings: boolean;
  needsChart: boolean;
}

const GROQ_ROUTER_MODEL =
  process.env.GROQ_ROUTER_MODEL || "llama-3.1-8b-instant";
const AI_ROUTER_LOGGING = process.env.AI_ROUTER_LOGGING === "true";

const ROUTER_INTENTS: PromptIntent[] = [
  "results",
  "race_narrative",
  "strategy",
  "qualifying",
  "standings",
  "weather",
  "comparison",
  "general",
];

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}

function toolsForIntent(intent: PromptIntent): string[] {
  switch (intent) {
    case "race_narrative":
    case "strategy":
      return ["resolve_session", "get_race_dynamics"];
    case "qualifying":
    case "results":
    case "weather":
      return ["resolve_session"];
    case "standings":
    case "comparison":
    case "general":
      return [];
  }
}

function localConfidence(question: string, intent: PromptIntent): number {
  const q = question.toLowerCase();

  if (
    intent === "race_narrative" &&
    /\b(dominant|dominated|led|lead|pole[- ]to[- ]flag|safety car|vsc|strategy|pit|recovered|regained|turning point|how did|why did)\b/.test(
      q,
    )
  ) {
    return 0.9;
  }

  if (
    intent === "standings" &&
    /\b(standings|championship|points|title)\b/.test(q)
  ) {
    return 0.9;
  }

  if (
    intent === "qualifying" &&
    /\b(quali|qualifying|q1|q2|q3|pole)\b/.test(q)
  ) {
    return 0.88;
  }

  if (intent === "weather" && /\b(weather|rain|wet|dry)\b/.test(q)) {
    return 0.88;
  }

  if (
    intent === "comparison" &&
    /\b(compare|versus| vs |head[- ]to[- ]head)\b/.test(q)
  ) {
    return 0.86;
  }

  if (
    intent === "results" &&
    /\b(who won|winner|podium|result|finished)\b/.test(q)
  ) {
    return 0.82;
  }

  return intent === "general" ? 0.45 : 0.62;
}

function buildDecision(
  intent: PromptIntent,
  confidence: number,
  source: AIRoutingDecision["source"],
  overrides: Partial<AIRoutingDecision> = {},
): AIRoutingDecision {
  return {
    intent,
    confidence,
    source,
    requiredTools: toolsForIntent(intent),
    needsLapEvidence: intent === "race_narrative" || intent === "strategy",
    needsRaceControl: intent === "race_narrative" || intent === "strategy",
    needsWeather: intent === "weather",
    needsStandings: intent === "standings",
    needsChart: false,
    ...overrides,
  };
}

function logRouting(
  event: string,
  details: Record<string, unknown>,
  startedAt?: number,
) {
  if (!AI_ROUTER_LOGGING) {
    return;
  }

  const elapsedMs = startedAt ? Date.now() - startedAt : undefined;
  console.info(
    "[ai-router]",
    JSON.stringify({
      event,
      ...details,
      ...(elapsedMs !== undefined ? { elapsedMs } : {}),
    }),
  );
}

function deterministicRoute(question: string): AIRoutingDecision {
  const intent = inferPromptIntent(question);
  const needsChart = /\b(chart|graph|plot|visuali[sz]e|trend)\b/i.test(
    question,
  );
  return buildDecision(
    intent,
    localConfidence(question, intent),
    "deterministic",
    {
      needsChart,
    },
  );
}

function shouldUseGroq(decision: AIRoutingDecision, question: string): boolean {
  if (!process.env.GROQ_API_KEY) {
    return false;
  }

  if (decision.confidence < 0.8) {
    return true;
  }

  return /\b(what happened|explain|why|how|legit|luck|turning point|actually|story)\b/i.test(
    question,
  );
}

function parseGroqDecision(text: string): Partial<AIRoutingDecision> | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  const intent = typeof parsed.intent === "string" ? parsed.intent : null;
  if (!intent || !ROUTER_INTENTS.includes(intent as PromptIntent)) {
    return null;
  }

  return {
    intent: intent as PromptIntent,
    confidence: clampConfidence(parsed.confidence),
    requiredTools: Array.isArray(parsed.requiredTools)
      ? parsed.requiredTools.filter(
          (tool): tool is string => typeof tool === "string",
        )
      : undefined,
    needsLapEvidence:
      typeof parsed.needsLapEvidence === "boolean"
        ? parsed.needsLapEvidence
        : undefined,
    needsRaceControl:
      typeof parsed.needsRaceControl === "boolean"
        ? parsed.needsRaceControl
        : undefined,
    needsWeather:
      typeof parsed.needsWeather === "boolean"
        ? parsed.needsWeather
        : undefined,
    needsStandings:
      typeof parsed.needsStandings === "boolean"
        ? parsed.needsStandings
        : undefined,
    needsChart:
      typeof parsed.needsChart === "boolean" ? parsed.needsChart : undefined,
  };
}

async function routeWithGroq(
  question: string,
): Promise<Partial<AIRoutingDecision> | null> {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_ROUTER_MODEL,
        temperature: 0,
        max_tokens: 220,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You route questions for an F1 analytics app. Return JSON only.

Choose the smallest useful intent:
- results: simple winner, podium, finishing order, result lookup
- race_narrative: how a race unfolded, lead changes, dominance, recovery, safety car, luck, turning point
- strategy: tyres, stints, pit stops, undercut/overcut, pace, degradation
- qualifying: qualifying, pole, Q1/Q2/Q3
- standings: championship, points, title, constructor/driver standings
- weather: rain, wet/dry, temperatures, wind
- comparison: compare drivers/teams/seasons/head-to-head
- general: F1 rules/context or unclear

Require resolve_session for event-specific questions.
Require get_race_dynamics for race_narrative and strategy, and for any claim about dominance, lead changes, SC/VSC, pit timing, recovery, or whether a win was deserved/lucky.

Schema:
{"intent":"race_narrative","confidence":0.0,"requiredTools":["resolve_session","get_race_dynamics"],"needsLapEvidence":true,"needsRaceControl":true,"needsWeather":false,"needsStandings":false,"needsChart":false}`,
          },
          {
            role: "user",
            content: question,
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Groq router failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  return text ? parseGroqDecision(text) : null;
}

export async function routeAIRequest(
  question: string,
): Promise<AIRoutingDecision> {
  const startedAt = Date.now();
  const deterministic = deterministicRoute(question);
  logRouting("deterministic", {
    intent: deterministic.intent,
    confidence: deterministic.confidence,
    requiredTools: deterministic.requiredTools,
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
  });

  if (!shouldUseGroq(deterministic, question)) {
    logRouting(
      "selected",
      {
        source: deterministic.source,
        intent: deterministic.intent,
        confidence: deterministic.confidence,
        requiredTools: deterministic.requiredTools,
        reason: process.env.GROQ_API_KEY
          ? "deterministic_confident"
          : "groq_key_missing",
      },
      startedAt,
    );
    return deterministic;
  }

  try {
    const groq = await routeWithGroq(question);
    if (!groq?.intent) {
      const fallback = buildDecision(
        deterministic.intent,
        deterministic.confidence,
        "fallback",
        {
          needsChart: deterministic.needsChart,
        },
      );
      logRouting(
        "selected",
        {
          source: fallback.source,
          intent: fallback.intent,
          confidence: fallback.confidence,
          requiredTools: fallback.requiredTools,
          reason: "groq_unparseable",
        },
        startedAt,
      );
      return fallback;
    }

    const decision = buildDecision(
      groq.intent,
      groq.confidence ?? 0.75,
      "groq",
      {
        requiredTools: groq.requiredTools || toolsForIntent(groq.intent),
        needsLapEvidence: groq.needsLapEvidence,
        needsRaceControl: groq.needsRaceControl,
        needsWeather: groq.needsWeather,
        needsStandings: groq.needsStandings,
        needsChart: groq.needsChart || deterministic.needsChart,
      },
    );
    logRouting(
      "selected",
      {
        source: decision.source,
        intent: decision.intent,
        confidence: decision.confidence,
        requiredTools: decision.requiredTools,
        needsLapEvidence: decision.needsLapEvidence,
        needsRaceControl: decision.needsRaceControl,
      },
      startedAt,
    );
    return decision;
  } catch (error) {
    const fallback = buildDecision(
      deterministic.intent,
      deterministic.confidence,
      "fallback",
      {
        needsChart: deterministic.needsChart,
      },
    );
    logRouting(
      "selected",
      {
        source: fallback.source,
        intent: fallback.intent,
        confidence: fallback.confidence,
        requiredTools: fallback.requiredTools,
        reason: "groq_error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      startedAt,
    );
    return fallback;
  }
}
