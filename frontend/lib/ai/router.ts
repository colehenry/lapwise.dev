import { routeWithGroq, shouldUseGroq } from "./groq-router";
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

const AI_ROUTER_LOGGING = process.env.AI_ROUTER_LOGGING === "true";

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
