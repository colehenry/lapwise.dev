/**
 * Chat API Helpers
 *
 * Wrappers around AI API endpoints using fetchWithAuth for authentication.
 */

import { fetchWithAuth } from "@/lib/auth";

const BASE = "/api/ai";

export interface ChatConversation {
  id: string;
  title: string;
  model_used: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls: string[] | null;
  tool_results: ChartConfig[] | null;
  tokens_used: number | null;
  model: string | null;
  created_at: string;
}

export interface ChartConfig {
  chartType: "bar" | "line" | "scatter" | "pie" | "stacked_bar";
  title: string;
  xLabel: string;
  yLabel: string;
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
  colors: string[];
  seriesLabels?: string[];
}

export interface AskResponse {
  answer: string;
  charts: ChartConfig[];
  queries: string[];
  conversationId: string;
  remaining: number | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface AskError {
  error: string;
  remaining?: number | null;
}

export interface StreamInitEvent {
  type: "init";
  conversationId: string;
  remaining: number | null;
}

export interface StreamTextDeltaEvent {
  type: "text-delta";
  text: string;
}

export interface StreamMetadataEvent {
  type: "metadata";
  conversationId: string;
  remaining: number | null;
  charts: ChartConfig[];
  queries: string[];
  followUps: string[];
  usage: AskResponse["usage"];
}

export type StepType =
  | "sql"
  | "schema"
  | "sample"
  | "chart"
  | "thinking"
  | "synthesizing";

export interface StreamStatusEvent {
  type: "status";
  message: string;
  stepType?: StepType;
}

export interface ThinkingStep {
  message: string;
  stepType: StepType;
  timestamp: number;
}

export interface StreamErrorEvent {
  type: "error";
  error: string;
}

export type AskStreamEvent =
  | StreamInitEvent
  | StreamTextDeltaEvent
  | StreamStatusEvent
  | StreamMetadataEvent
  | StreamErrorEvent;

/**
 * Send a question to the AI analyst.
 */
export async function askQuestion(
  question: string,
  conversationId?: string,
): Promise<AskResponse> {
  const res = await fetchWithAuth(`${BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, conversationId }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error((data as AskError).error || "Failed to get answer");
  }

  return data as AskResponse;
}

/**
 * Stream a question response from the AI analyst.
 */
export async function streamQuestion(
  question: string,
  conversationId: string | undefined,
  onEvent: (event: AskStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, conversationId }),
    signal,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as AskError | null;
    throw new Error(data?.error || "Failed to get answer");
  }

  if (!res.body) {
    throw new Error("Streaming response body was empty");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) {
      reader.cancel().catch(() => {});
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as AskStreamEvent);
    }

    if (done) {
      if (buffer.trim()) {
        onEvent(JSON.parse(buffer) as AskStreamEvent);
      }
      break;
    }
  }
}

/**
 * List user's conversations.
 */
export async function listConversations(): Promise<ChatConversation[]> {
  const res = await fetchWithAuth(`${BASE}/conversations`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to load conversations");
  }

  return data.conversations;
}

/**
 * Get a conversation with all messages.
 */
export async function getConversation(id: string): Promise<{
  conversation: ChatConversation;
  messages: ChatMessage[];
}> {
  const res = await fetchWithAuth(`${BASE}/conversations/${id}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to load conversation");
  }

  return data;
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(id: string): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/conversations/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete conversation");
  }
}

export interface CachedResponse {
  text: string;
  charts: ChartConfig[];
  queries: string[];
  followUps: string[];
}

/**
 * Fetch a cached AI response for a suggestion question.
 * Returns null on cache miss or any error.
 */
export async function fetchCachedResponse(
  question: string,
): Promise<CachedResponse | null> {
  try {
    const res = await fetchWithAuth(
      `${BASE}/cached-response?q=${encodeURIComponent(question)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as CachedResponse;
  } catch {
    return null;
  }
}

/**
 * Rename a conversation.
 */
export async function renameConversation(
  id: string,
  title: string,
): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to rename conversation");
  }
}
