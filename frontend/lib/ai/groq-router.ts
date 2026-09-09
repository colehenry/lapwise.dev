import type { AIRoutingDecision } from "./router";
import type { PromptIntent } from "./system-prompt";

const GROQ_ROUTER_MODEL = process.env.GROQ_ROUTER_MODEL || "openai/gpt-oss-20b";

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

export function shouldUseGroq(
  decision: AIRoutingDecision,
  question: string,
): boolean {
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

export async function routeWithGroq(
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
        max_tokens: 1024,
        reasoning_effort: "low",
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
