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

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs, streamText } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { verifyAIUser } from "@/lib/ai/auth";
import { getConversationClient } from "@/lib/ai/db";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import {
  generateChart,
  getSampleData,
  getTableSchema,
  runSQLQuery,
} from "@/lib/ai/tools";

const AI_DAILY_QUERY_LIMIT = Number.parseInt(
  process.env.AI_DAILY_QUERY_LIMIT || "20",
  10,
);
const AI_MODEL = process.env.AI_MODEL || "claude-sonnet-4-20250514";

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

function encodeLine(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
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

  return JSON.stringify(output);
}

async function buildFallbackAnswer(params: {
  question: string;
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

  const fallback = await generateText({
    model: anthropic(AI_MODEL),
    system: buildSystemPrompt(),
    prompt: synthesisPrompt,
  });

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
): Promise<{ allowed: boolean; remaining: number }> {
  const sql = getConversationClient();

  // Reset counter if it's a new day
  await sql`
		UPDATE users
		SET ai_queries_today = 0, ai_queries_reset_at = NOW()
		WHERE id = ${userId}
		AND (ai_queries_reset_at IS NULL OR ai_queries_reset_at < CURRENT_DATE)
	`;

  // Check current count
  const result = await sql`
		SELECT ai_queries_today FROM users WHERE id = ${userId}
	`;

  const current = (result[0]?.ai_queries_today as number) ?? 0;

  if (current >= AI_DAILY_QUERY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  // Increment counter
  await sql`
		UPDATE users SET ai_queries_today = ai_queries_today + 1 WHERE id = ${userId}
	`;

  return { allowed: true, remaining: AI_DAILY_QUERY_LIMIT - current - 1 };
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
  // 1. Authenticate user
  const authHeader = request.headers.get("authorization");
  const user = await verifyAIUser(authHeader);

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
  const rateLimit = await checkRateLimit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Daily query limit reached (${AI_DAILY_QUERY_LIMIT}/day). Try again tomorrow.`,
        remaining: 0,
      },
      { status: 429 },
    );
  }

  // 4. Get or create conversation
  let conversationId = existingConversationId;

  if (conversationId) {
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
  const history = await loadConversationHistory(conversationId);

  // 6. Build messages array
  const messages = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: question },
  ];

  // 7. Save user message
  await saveMessage(conversationId, "user", question);

  // 8. Run the AI agent loop
  try {
    const result = streamText({
      model: anthropic(AI_MODEL),
      system: buildSystemPrompt(),
      messages,
      tools: {
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
        let heartbeatMessageIndex = 0;
        const heartbeatMessages = [
          "Planning the analysis...",
          "Querying the F1 database...",
          "Comparing results across sessions...",
          "Assembling the final report...",
        ];
        const heartbeat = setInterval(() => {
          controller.enqueue(
            encodeLine({
              type: "status",
              message:
                heartbeatMessages[
                  heartbeatMessageIndex++ % heartbeatMessages.length
                ],
            }),
          );
        }, 2000);

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
          }),
        );

        try {
          for await (const part of result.fullStream) {
            if (part.type === "text-delta") {
              answer += part.text;
              controller.enqueue(
                encodeLine({ type: "text-delta", text: part.text }),
              );
              continue;
            }

            if (
              part.type === "tool-call" &&
              part.toolName === "run_sql_query"
            ) {
              controller.enqueue(
                encodeLine({
                  type: "status",
                  message: `Running SQL query ${sqlQueries.length + 1}...`,
                }),
              );
              const input = part.input as { sql?: string };
              if (input.sql) {
                sqlQueries.push(input.sql);
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
                controller.enqueue(
                  encodeLine({
                    type: "status",
                    message: "Chart generated, continuing analysis...",
                  }),
                );
              } else if (part.toolName === "run_sql_query") {
                controller.enqueue(
                  encodeLine({
                    type: "status",
                    message: "SQL results received, analyzing...",
                  }),
                );
              }
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
              }),
            );

            const fallbackAnswer = await buildFallbackAnswer({
              question,
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

          await saveMessage(conversationId, "assistant", answer, {
            toolCalls: sqlQueries.length > 0 ? sqlQueries : undefined,
            toolResults: charts.length > 0 ? charts : undefined,
            tokensUsed: usage.totalTokens,
            model: AI_MODEL,
          });

          controller.enqueue(
            encodeLine({
              type: "metadata",
              conversationId,
              remaining: rateLimit.remaining,
              charts,
              queries: sqlQueries,
              usage,
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
          clearInterval(heartbeat);
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
