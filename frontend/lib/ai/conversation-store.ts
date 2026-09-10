import * as Sentry from "@sentry/nextjs";
import { getConversationClient } from "./db";
import { createResponseCacheHash } from "./response-cache-key";
import { isSuggestedQuestion } from "./suggestions";

const AI_HISTORY_MESSAGE_LIMIT = Number.parseInt(
  process.env.AI_HISTORY_MESSAGE_LIMIT || "12",
  10,
);
const AI_HISTORY_CHARACTER_LIMIT = Number.parseInt(
  process.env.AI_HISTORY_CHARACTER_LIMIT || "24000",
  10,
);

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export function boundConversationHistory(
  messages: ConversationMessage[],
  characterLimit = AI_HISTORY_CHARACTER_LIMIT,
): ConversationMessage[] {
  const bounded: ConversationMessage[] = [];
  let remaining = Math.max(0, characterLimit);

  for (
    let index = messages.length - 1;
    index >= 0 && remaining > 0;
    index -= 1
  ) {
    const message = messages[index];
    const content = message.content.slice(0, remaining);
    bounded.unshift({ ...message, content });
    remaining -= content.length;
    if (content.length < message.content.length) break;
  }

  return bounded;
}

export async function loadConversationHistory(
  conversationId: string,
): Promise<ConversationMessage[]> {
  try {
    const sql = getConversationClient();
    const messages = await sql`
      SELECT role, content FROM (
        SELECT role, content, created_at FROM ai_messages
        WHERE conversation_id = ${conversationId}::uuid
        ORDER BY created_at DESC
        LIMIT ${AI_HISTORY_MESSAGE_LIMIT}
      ) recent_messages
      ORDER BY created_at ASC
    `;
    const history = messages
      .filter(
        (message) => message.role === "user" || message.role === "assistant",
      )
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content as string,
      }));
    return boundConversationHistory(history);
  } catch {
    return [];
  }
}

export async function saveConversationMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  extra: {
    toolCalls?: unknown;
    toolResults?: unknown;
    tokensUsed?: number;
    model?: string;
  } = {},
): Promise<void> {
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
      SET
        message_count = message_count + 1,
        updated_at = NOW(),
        model_used = CASE
          WHEN ${role} = 'assistant' AND ${model} IS NOT NULL THEN ${model}
          ELSE model_used
        END
      WHERE id = ${conversationId}::uuid
    `;
  } catch (error) {
    Sentry.captureException(error);
  }
}

export function buildConversationTitle(question: string): string {
  const normalized = question.replace(/\s+/g, " ").trim();
  if (normalized.length <= 60) return normalized;

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

  return keywords.length >= 20
    ? keywords.slice(0, 80)
    : `${normalized.slice(0, 77)}...`;
}

export async function createConversation(
  userId: number,
  title: string,
  model: string,
): Promise<string> {
  const sql = getConversationClient();
  const result = await sql`
    INSERT INTO ai_conversations (id, user_id, title, model_used, message_count)
    VALUES (gen_random_uuid(), ${userId}, ${title.slice(0, 200)}, ${model}, 0)
    RETURNING id
  `;
  return result[0].id as string;
}

export async function checkUserQueryLimit(
  userId: number,
  userRole: string,
  totalLimit: number,
): Promise<{ allowed: boolean; remaining: number | null }> {
  if (userRole === "admin") return { allowed: true, remaining: null };

  const sql = getConversationClient();
  const result = await sql`
    UPDATE users
    SET ai_queries_used = ai_queries_used + 1
    WHERE id = ${userId}
      AND ai_queries_used < ${totalLimit}
    RETURNING ai_queries_used
  `;
  if (result.length === 0) return { allowed: false, remaining: 0 };

  const updated = (result[0]?.ai_queries_used as number) ?? totalLimit;
  return { allowed: true, remaining: Math.max(0, totalLimit - updated) };
}

export async function verifyConversationOwnership(
  conversationId: string,
  userId: number,
): Promise<boolean> {
  const sql = getConversationClient();
  const result = await sql`
    SELECT id FROM ai_conversations
    WHERE id = ${conversationId}::uuid AND user_id = ${userId}
  `;
  return result.length > 0;
}

export async function writeCachedResponse(
  question: string,
  text: string,
  charts: unknown[],
  queries: string[],
  followUps: string[],
): Promise<void> {
  if (!isSuggestedQuestion(question) || !text.trim()) return;

  try {
    const hash = createResponseCacheHash(question);
    const sql = getConversationClient();
    await sql`
      INSERT INTO ai_response_cache (question_hash, response_text, charts_json, queries_json, follow_ups_json, cached_at)
      VALUES (${hash}, ${text}, ${JSON.stringify(charts)}::jsonb, ${JSON.stringify(queries)}::jsonb, ${JSON.stringify(followUps)}::jsonb, NOW())
      ON CONFLICT (question_hash) DO UPDATE SET
        response_text = EXCLUDED.response_text,
        charts_json = EXCLUDED.charts_json,
        queries_json = EXCLUDED.queries_json,
        follow_ups_json = EXCLUDED.follow_ups_json,
        cached_at = NOW()
    `;
  } catch {
    // Suggested-answer caching is best effort.
  }
}
