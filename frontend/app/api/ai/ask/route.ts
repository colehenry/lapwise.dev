/**
 * AI Ask API Route
 *
 * POST /api/ai/ask
 *
 * Handles user questions by running an AI agent loop that can query
 * the F1 database, analyze results, and generate visualizations.
 *
 * Requires authentication. Rate-limited per user.
 */

import crypto from "node:crypto";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs, streamText } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { verifyAIUser } from "@/lib/ai/auth";
import { getConversationClient } from "@/lib/ai/db";
import type { AIRoutingDecision } from "@/lib/ai/router";
import { routeAIRequest } from "@/lib/ai/router";
import { isSuggestedQuestion } from "@/lib/ai/suggestions";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import {
  generateChart,
  getRaceDynamics,
  getSampleData,
  getTableSchema,
  resolveSession,
  runSQLQuery,
} from "@/lib/ai/tools";

const AI_TOTAL_QUERY_LIMIT = Number.parseInt(
  process.env.AI_TOTAL_QUERY_LIMIT || "3",
  10,
);
const AI_MODEL = process.env.AI_MODEL || "claude-sonnet-4-20250514";
const AI_IP_RATE_LIMIT_PER_MINUTE = Number.parseInt(
  process.env.AI_IP_RATE_LIMIT_PER_MINUTE || "6",
  10,
);

interface AskRequest {
  question: string;
  conversationId?: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface StreamUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface ToolSummary {
  toolName: string;
  summary: string;
}

interface RequestUser {
  id: number;
  username: string;
  role: string;
}

const SEED_MODE_HEADER = "x-ai-seed-mode";
const DUMMY_SEED_CONVERSATION_ID = "seed-suggested-question-cache";
const aiIpBuckets = new Map<string, { count: number; resetAt: number }>();

function encodeLine(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
}

function isSeedModeRequest(request: NextRequest): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    request.headers.get(SEED_MODE_HEADER) === "true"
  );
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function checkIpRateLimit(ip: string): {
  allowed: boolean;
  retryAfter: number;
} {
  const now = Date.now();
  const existing = aiIpBuckets.get(ip);

  if (!existing || existing.resetAt <= now) {
    aiIpBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, retryAfter: 0 };
  }

  if (existing.count >= AI_IP_RATE_LIMIT_PER_MINUTE) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function summarizeToolOutput(
  toolName: string,
  output: Record<string, unknown>,
): string {
  if (toolName === "run_sql_query") {
    const error = typeof output.error === "string" ? output.error : null;
    const count = typeof output.count === "number" ? output.count : null;
    const columns = Array.isArray(output.columns)
      ? output.columns.filter(
          (column): column is string => typeof column === "string",
        )
      : [];
    const rows = Array.isArray(output.rows) ? output.rows.slice(0, 5) : [];

    return JSON.stringify({
      type: "sql_result",
      error,
      count,
      columns,
      sampleRows: rows,
    });
  }

  if (toolName === "generate_chart") {
    return JSON.stringify({
      type: "chart_result",
      config: output.config,
    });
  }

  if (toolName === "resolve_session") {
    const error = typeof output.error === "string" ? output.error : null;
    const count = typeof output.count === "number" ? output.count : null;
    const rows = Array.isArray(output.rows) ? output.rows.slice(0, 10) : [];

    return JSON.stringify({
      type: "session_resolution",
      error,
      count,
      rows,
      note: output.note,
    });
  }

  if (toolName === "get_race_dynamics") {
    return JSON.stringify({
      type: "race_dynamics",
      sessionId: output.sessionId,
      leaderTimeline: output.leaderTimeline,
      lapsLed: output.lapsLed,
      neutralizedLaps: output.neutralizedLaps,
      positionPaths: output.positionPaths,
      pitStops: output.pitStops,
      raceControl: Array.isArray(output.raceControl)
        ? output.raceControl.slice(0, 10)
        : output.raceControl,
      evidenceRules: output.evidenceRules,
      error: output.error,
    });
  }

  return JSON.stringify(output);
}

async function generateFollowUps(
  question: string,
  answer: string,
): Promise<string[]> {
  try {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 10000);
    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system:
        "You generate one follow-up question suggestion for an F1 analytics chatbot. Return exactly 1 short, specific, actionable question as a JSON array with one string. No explanation, just the array.",
      prompt: `User asked: "${question}"\n\nAnswer summary: "${answer.slice(0, 800)}"\n\nGenerate 1 follow-up question as a JSON array with one string.`,
      maxOutputTokens: 80,
      abortSignal: timeoutController.signal,
    });
    clearTimeout(timeoutId);
    const trimmed = result.text.trim();
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
        return parsed.slice(0, 1);
      }
    }
    return [];
  } catch {
    return [];
  }
}

async function writeCachedResponse(
  question: string,
  text: string,
  charts: unknown[],
  queries: string[],
  followUps: string[],
): Promise<void> {
  if (!isSuggestedQuestion(question)) {
    return;
  }

  try {
    const hash = crypto
      .createHash("md5")
      .update(question.toLowerCase().trim())
      .digest("hex");
    const sql = getConversationClient();
    await sql`
      INSERT INTO ai_response_cache (question_hash, response_text, charts_json, queries_json, follow_ups_json, cached_at)
      VALUES (
        ${hash},
        ${text},
        ${JSON.stringify(charts)}::jsonb,
        ${JSON.stringify(queries)}::jsonb,
        ${JSON.stringify(followUps)}::jsonb,
        NOW()
      )
      ON CONFLICT (question_hash) DO UPDATE SET
        response_text  = EXCLUDED.response_text,
        charts_json    = EXCLUDED.charts_json,
        queries_json   = EXCLUDED.queries_json,
        follow_ups_json = EXCLUDED.follow_ups_json,
        cached_at      = NOW()
    `;
  } catch (error) {
    console.error("Failed to write AI response cache:", error);
  }
}

async function buildFallbackAnswer(params: {
  question: string;
  routing: AIRoutingDecision;
  queries: string[];
  toolSummaries: ToolSummary[];
}): Promise<string> {
  const synthesisPrompt = `The agent collected data for this user question but did not finish the final report.

User question:
${params.question}

Executed SQL queries:
${params.queries.length > 0 ? params.queries.map((query, index) => `${index + 1}. ${query}`).join("\n\n") : "None"}

Tool outputs:
${params.toolSummaries
  .map((tool, index) => `${index + 1}. ${tool.toolName}\n${tool.summary}`)
  .join("\n\n")}

Write the final answer to the user now. Use only the retrieved data, mention if any query failed, and do not mention internal tool usage unless it helps explain a limitation.`;

  const fallbackController = new AbortController();
  const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 30000);
  const fallback = await generateText({
    model: anthropic(AI_MODEL),
    system: buildSystemPrompt({
      question: params.question,
      intent: params.routing.intent,
      requiredTools: params.routing.requiredTools,
      routerSource: params.routing.source,
      routerConfidence: params.routing.confidence,
    }),
    prompt: synthesisPrompt,
    abortSignal: fallbackController.signal,
  });
  clearTimeout(fallbackTimeoutId);

  return fallback.text;
}

/**
 * Load conversation history from the database.
 */
async function loadConversationHistory(
  conversationId: string,
): Promise<ConversationMessage[]> {
  try {
    const sql = getConversationClient();
    const messages = await sql`
			SELECT role, content FROM ai_messages
			WHERE conversation_id = ${conversationId}::uuid
			ORDER BY created_at ASC
		`;
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content as string,
      }));
  } catch {
    return [];
  }
}

/**
 * Save a message to the database.
 */
async function saveMessage(
  conversationId: string,
  role: string,
  content: string,
  extra: {
    toolCalls?: unknown;
    toolResults?: unknown;
    tokensUsed?: number;
    model?: string;
  } = {},
) {
  try {
    const sql = getConversationClient();
    const toolCallsJson = extra.toolCalls
      ? JSON.stringify(extra.toolCalls)
      : null;
    const toolResultsJson = extra.toolResults
      ? JSON.stringify(extra.toolResults)
      : null;
    const tokensUsed = extra.tokensUsed ?? null;
    const model = extra.model ?? null;

    await sql`
			INSERT INTO ai_messages (id, conversation_id, role, content, tool_calls, tool_results, tokens_used, model)
			VALUES (gen_random_uuid(), ${conversationId}::uuid, ${role}, ${content}, ${toolCallsJson}::jsonb, ${toolResultsJson}::jsonb, ${tokensUsed}, ${model})
		`;

    await sql`
			UPDATE ai_conversations
			SET message_count = message_count + 1, updated_at = NOW()
			WHERE id = ${conversationId}::uuid
		`;
  } catch (error) {
    console.error("Failed to save AI message:", error);
  }
}

function buildConversationTitle(question: string): string {
  const normalized = question.replace(/\s+/g, " ").trim();

  if (normalized.length <= 60) {
    return normalized;
  }

  const stopWords = new Set([
    "a",
    "an",
    "and",
    "about",
    "at",
    "for",
    "from",
    "in",
    "of",
    "on",
    "the",
    "to",
    "vs",
    "with",
  ]);

  const keywords = normalized
    .split(" ")
    .filter((word) => word.length > 2)
    .filter((word) => !stopWords.has(word.toLowerCase()))
    .slice(0, 8)
    .join(" ");

  if (keywords.length >= 20) {
    return keywords.slice(0, 80);
  }

  return `${normalized.slice(0, 77)}...`;
}

/**
 * Create a new conversation.
 */
async function createConversation(
  userId: number,
  title: string,
  model: string,
): Promise<string> {
  const sql = getConversationClient();
  const truncatedTitle = title.slice(0, 200);
  const result = await sql`
		INSERT INTO ai_conversations (id, user_id, title, model_used, message_count)
		VALUES (gen_random_uuid(), ${userId}, ${truncatedTitle}, ${model}, 0)
		RETURNING id
	`;
  return result[0].id as string;
}

/**
 * Check and update rate limit for a user.
 */
async function checkRateLimit(
  userId: number,
  userRole: string,
): Promise<{ allowed: boolean; remaining: number | null }> {
  if (userRole === "admin") {
    return { allowed: true, remaining: null };
  }

  const sql = getConversationClient();

  const result = await sql`
		UPDATE users
		SET ai_queries_today = ai_queries_today + 1
		WHERE id = ${userId}
		  AND ai_queries_today < ${AI_TOTAL_QUERY_LIMIT}
		RETURNING ai_queries_today
	`;

  if (result.length === 0) {
    return { allowed: false, remaining: 0 };
  }

  const updated =
    (result[0]?.ai_queries_today as number) ?? AI_TOTAL_QUERY_LIMIT;
  return {
    allowed: true,
    remaining: Math.max(0, AI_TOTAL_QUERY_LIMIT - updated),
  };
}

/**
 * Verify the conversation belongs to the user.
 */
async function verifyConversationOwnership(
  conversationId: string,
  userId: number,
): Promise<boolean> {
  const sql = getConversationClient();
  const result = await sql`
		SELECT id FROM ai_conversations WHERE id = ${conversationId}::uuid AND user_id = ${userId}
	`;
  return result.length > 0;
}

export async function POST(request: NextRequest) {
  const seedMode = isSeedModeRequest(request);
  const clientIp = getClientIp(request);

  if (!seedMode) {
    const ipLimit = checkIpRateLimit(clientIp);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many AI requests. Please slow down and try again shortly.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(ipLimit.retryAfter) },
        },
      );
    }
  }

  // 1. Authenticate user
  let user: RequestUser | null = null;

  if (seedMode) {
    user = {
      id: 0,
      username: "seed",
      role: "admin",
    };
  } else {
    const authHeader = request.headers.get("authorization");
    user = await verifyAIUser(authHeader);
  }

  if (!user) {
    return NextResponse.json(
      {
        error: "Authentication required. Please log in to use the AI analyst.",
      },
      { status: 401 },
    );
  }

  // 2. Parse request body
  let body: AskRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const { question, conversationId: existingConversationId } = body;

  if (!question?.trim()) {
    return NextResponse.json(
      { error: "Question is required." },
      { status: 400 },
    );
  }

  if (question.length > 2000) {
    return NextResponse.json(
      { error: "Question is too long (max 2000 characters)." },
      { status: 400 },
    );
  }

  // 3. Check rate limit
  const rateLimit = seedMode
    ? { allowed: true, remaining: null }
    : await checkRateLimit(user.id, user.role);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Total query limit reached (${AI_TOTAL_QUERY_LIMIT} total).`,
        remaining: 0,
      },
      { status: 429 },
    );
  }

  // 4. Get or create conversation
  let conversationId = existingConversationId;

  if (seedMode) {
    conversationId = DUMMY_SEED_CONVERSATION_ID;
  } else if (conversationId) {
    const isOwner = await verifyConversationOwnership(conversationId, user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }
  } else {
    conversationId = await createConversation(
      user.id,
      buildConversationTitle(question),
      AI_MODEL,
    );
  }

  // 5. Load conversation history
  const history = seedMode ? [] : await loadConversationHistory(conversationId);

  // 6. Build messages array
  const messages = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: question },
  ];

  // 7. Save user message
  if (!seedMode) {
    await saveMessage(conversationId, "user", question);
  }

  // 8. Run the AI agent loop
  try {
    const routing = await routeAIRequest(question);
    const result = streamText({
      model: anthropic(AI_MODEL),
      system: buildSystemPrompt({
        question,
        intent: routing.intent,
        requiredTools: routing.requiredTools,
        routerSource: routing.source,
        routerConfidence: routing.confidence,
      }),
      messages,
      tools: {
        resolve_session: resolveSession,
        get_race_dynamics: getRaceDynamics,
        run_sql_query: runSQLQuery,
        get_table_schema: getTableSchema,
        get_sample_data: getSampleData,
        generate_chart: generateChart,
      },
      toolChoice: "auto",
      stopWhen: stepCountIs(12),
    });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const charts: unknown[] = [];
        const sqlQueries: string[] = [];
        const toolSummaries: ToolSummary[] = [];
        let answer = "";
        let finishReason: string | null = null;
        let usage: StreamUsage = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        };
        let lastEventWasToolResult = false;

        controller.enqueue(
          encodeLine({
            type: "init",
            conversationId,
            remaining: rateLimit.remaining,
          }),
        );
        controller.enqueue(
          encodeLine({
            type: "status",
            message: "Planning the analysis...",
            stepType: "thinking",
          }),
        );

        try {
          for await (const part of result.fullStream) {
            if (part.type === "text-delta") {
              // Insert a separator when text resumes after a tool result
              if (lastEventWasToolResult && part.text.trim()) {
                const separator = "\n\n";
                answer += separator;
                controller.enqueue(
                  encodeLine({ type: "text-delta", text: separator }),
                );
                lastEventWasToolResult = false;
              }
              answer += part.text;
              controller.enqueue(
                encodeLine({ type: "text-delta", text: part.text }),
              );
              continue;
            }

            if (part.type === "tool-call") {
              const input = part.input as Record<string, unknown>;
              if (part.toolName === "run_sql_query") {
                if (typeof input.sql === "string") {
                  sqlQueries.push(input.sql);
                }
                controller.enqueue(
                  encodeLine({
                    type: "status",
                    message: `Running SQL query ${sqlQueries.length}...`,
                    stepType: "sql",
                  }),
                );
              } else if (part.toolName === "get_table_schema") {
                controller.enqueue(
                  encodeLine({
                    type: "status",
                    message: `Inspecting ${input.table_name || "table"} schema...`,
                    stepType: "schema",
                  }),
                );
              } else if (part.toolName === "get_sample_data") {
                controller.enqueue(
                  encodeLine({
                    type: "status",
                    message: `Sampling data from ${input.table_name || "table"}...`,
                    stepType: "sample",
                  }),
                );
              } else if (part.toolName === "resolve_session") {
                controller.enqueue(
                  encodeLine({
                    type: "status",
                    message: "Resolving the session...",
                    stepType: "sql",
                  }),
                );
              } else if (part.toolName === "get_race_dynamics") {
                controller.enqueue(
                  encodeLine({
                    type: "status",
                    message: "Building race dynamics evidence...",
                    stepType: "sql",
                  }),
                );
              } else if (part.toolName === "generate_chart") {
                controller.enqueue(
                  encodeLine({
                    type: "status",
                    message: "Generating visualization...",
                    stepType: "chart",
                  }),
                );
              }
              continue;
            }

            if (part.type === "tool-result") {
              const output = part.output as Record<string, unknown>;
              toolSummaries.push({
                toolName: part.toolName,
                summary: summarizeToolOutput(part.toolName, output),
              });

              if (output?.type === "chart") {
                charts.push(output.config);
              } else if (part.toolName === "run_sql_query") {
                const count =
                  typeof output.count === "number" ? output.count : 0;
                controller.enqueue(
                  encodeLine({
                    type: "status",
                    message: `Query returned ${count} rows`,
                    stepType: "thinking",
                  }),
                );
              }
              lastEventWasToolResult = true;
              continue;
            }

            if (part.type === "finish") {
              finishReason = part.finishReason;
              usage = {
                inputTokens: part.totalUsage.inputTokens ?? 0,
                outputTokens: part.totalUsage.outputTokens ?? 0,
                totalTokens:
                  (part.totalUsage.inputTokens ?? 0) +
                  (part.totalUsage.outputTokens ?? 0),
              };
            }
          }

          if (
            (finishReason === "tool-calls" || answer.trim().length < 80) &&
            toolSummaries.length > 0
          ) {
            controller.enqueue(
              encodeLine({
                type: "status",
                message: "Synthesizing the final report...",
                stepType: "synthesizing",
              }),
            );

            const fallbackAnswer = await buildFallbackAnswer({
              question,
              routing,
              queries: sqlQueries,
              toolSummaries,
            });

            if (fallbackAnswer.trim()) {
              answer = answer.trim()
                ? `${answer.trim()}\n\n${fallbackAnswer.trim()}`
                : fallbackAnswer.trim();
              controller.enqueue(
                encodeLine({
                  type: "text-delta",
                  text:
                    answer.trim() === fallbackAnswer.trim()
                      ? fallbackAnswer
                      : `\n\n${fallbackAnswer}`,
                }),
              );
            }
          }

          const followUps = await generateFollowUps(question, answer);

          if (!seedMode) {
            await saveMessage(conversationId, "assistant", answer, {
              toolCalls: sqlQueries.length > 0 ? sqlQueries : undefined,
              toolResults: charts.length > 0 ? charts : undefined,
              tokensUsed: usage.totalTokens,
              model: AI_MODEL,
            });
          }

          // Cache the response for future use (fire-and-forget)
          writeCachedResponse(question, answer, charts, sqlQueries, followUps);

          controller.enqueue(
            encodeLine({
              type: "metadata",
              conversationId,
              remaining: rateLimit.remaining,
              charts,
              queries: sqlQueries,
              followUps,
              usage,
              routing,
            }),
          );
        } catch (error) {
          console.error("AI stream error:", error);
          const message =
            error instanceof Error
              ? error.message
              : "An unexpected error occurred";
          controller.enqueue(
            encodeLine({
              type: "error",
              error: `AI processing failed: ${message}`,
            }),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI agent error:", error);
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { error: `AI processing failed: ${message}` },
      { status: 500 },
    );
  }
}
