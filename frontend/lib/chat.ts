/**
 * Chat API Helpers
 *
 * Wrappers around AI API endpoints using fetchWithAuth for authentication.
 */

import type { AnalysisPageContext } from "@/lib/ai/analysis-contracts";
import { fetchWithAuth } from "@/lib/auth";
import { CLUTCH_ASK_BASE } from "@/lib/clutch-endpoint";
import type { ClutchProgressStatus } from "@/lib/clutch-progress";

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
  seriesColors?: Record<string, string>;
  categoryColors?: Record<string, string>;
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
    cachedInputTokens?: number;
    reasoningTokens?: number;
    costUsd?: number;
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
  model?: {
    id: string;
    provider: string;
    upstreamProvider?: string;
  };
  plan?: unknown;
}

export interface StreamStatusEvent extends ClutchProgressStatus {
  type: "status";
}

export interface StreamErrorEvent {
  type: "error";
  error: string;
}

export interface CachedResponse {
  text: string;
  charts: ChartConfig[];
  queries: string[];
  followUps: string[];
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
  pageContext?: AnalysisPageContext,
): Promise<AskResponse> {
  const res = await fetchWithAuth(`${CLUTCH_ASK_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, conversationId, pageContext }),
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
  pageContext?: AnalysisPageContext,
): Promise<void> {
  const res = await fetchWithAuth(`${CLUTCH_ASK_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, conversationId, pageContext }),
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
  let completed = false;

  function emitLine(line: string) {
    let event: AskStreamEvent;
    try {
      event = JSON.parse(line) as AskStreamEvent;
    } catch {
      throw new Error("Clutch's response was interrupted. Please try again.");
    }
    if (event.type === "metadata" || event.type === "error") completed = true;
    onEvent(event);
  }

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
      emitLine(line);
    }

    if (done) {
      if (buffer.trim()) {
        emitLine(buffer);
      }
      break;
    }
  }

  if (!completed) {
    throw new Error(
      "Clutch lost the connection before finishing. Please try again.",
    );
  }
}

export async function fetchCachedResponse(
  question: string,
  signal?: AbortSignal,
): Promise<CachedResponse | null> {
  try {
    const res = await fetchWithAuth(
      `${BASE}/cached-response?q=${encodeURIComponent(question)}`,
      { signal },
    );
    if (!res.ok) return null;
    return (await res.json()) as CachedResponse;
  } catch {
    return null;
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
