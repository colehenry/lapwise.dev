import type {
  CachedResponse,
  ChartConfig,
  ChatMessage,
  StreamMetadataEvent,
  ThinkingStep,
} from "@/lib/chat";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  charts?: ChartConfig[];
  queries?: string[];
  steps?: ThinkingStep[];
  followUps?: string[];
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function chartArray(value: unknown): ChartConfig[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value as ChartConfig[];
}

export function toDisplayMessages(messages: ChatMessage[]): DisplayMessage[] {
  return messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      content: message.content,
      charts: chartArray(message.tool_results),
      queries: stringArray(message.tool_calls),
    }));
}

export function appendStreamText(
  messages: DisplayMessage[],
  assistantMessageId: string,
  text: string,
): DisplayMessage[] {
  return messages.map((message) =>
    message.id === assistantMessageId
      ? { ...message, content: message.content + text }
      : message,
  );
}

export function appendThinkingStep(
  messages: DisplayMessage[],
  assistantMessageId: string,
  step: ThinkingStep,
): DisplayMessage[] {
  return messages.map((message) =>
    message.id === assistantMessageId
      ? { ...message, steps: [...(message.steps ?? []), step] }
      : message,
  );
}

export function attachStreamMetadata(
  messages: DisplayMessage[],
  assistantMessageId: string,
  metadata: StreamMetadataEvent,
): DisplayMessage[] {
  return messages.map((message) =>
    message.id === assistantMessageId
      ? {
          ...message,
          charts: metadata.charts,
          queries: metadata.queries,
          followUps: metadata.followUps,
        }
      : message,
  );
}

export function attachCachedResponse(
  messages: DisplayMessage[],
  assistantMessageId: string,
  cached: CachedResponse,
): DisplayMessage[] {
  return messages.map((message) =>
    message.id === assistantMessageId
      ? {
          ...message,
          content: cached.text,
          charts: cached.charts,
          queries: cached.queries,
          followUps: cached.followUps,
        }
      : message,
  );
}

export function removeEmptyAssistant(
  messages: DisplayMessage[],
  assistantMessageId: string,
): DisplayMessage[] {
  return messages.filter(
    (message) =>
      message.id !== assistantMessageId || message.content.trim().length > 0,
  );
}
