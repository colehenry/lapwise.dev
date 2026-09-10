import * as Sentry from "@sentry/nextjs";
import { stepCountIs, streamText } from "ai";
import type { AnalysisPageContext } from "./analysis-contracts";
import {
  collectEntityReferences,
  type EntityReference,
  presentAgentAnswer,
} from "./answer-presentation";
import {
  saveConversationMessage,
  writeCachedResponse,
} from "./conversation-store";
import { encodeStreamLine } from "./deterministic-response";
import {
  buildFallbackAnswer,
  legacyToolStatus,
  summarizeToolOutput,
  type ToolSummary,
} from "./legacy-agent-support";
import { type AIModelSelection, extractAIProviderUsage } from "./provider";
import { getSeasonContext } from "./season-context-tool";
import { buildSystemPrompt } from "./system-prompt";
import {
  generateChart,
  getRaceDynamics,
  resolveSession,
  runSQLQuery,
} from "./tools";

interface LegacyMessage {
  role: "user" | "assistant";
  content: string;
}

interface StreamUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  costUsd?: number;
}

export async function createLegacyAgentResponse(params: {
  question: string;
  conversationId: string;
  remaining: number | null;
  seedMode: boolean;
  messages: LegacyMessage[];
  model: AIModelSelection;
  abortSignal?: AbortSignal;
  pageContext?: AnalysisPageContext;
}): Promise<Response> {
  const tools = {
    get_season_context: getSeasonContext,
    resolve_session: resolveSession,
    get_race_dynamics: getRaceDynamics,
    generate_chart: generateChart,
    run_sql_query: runSQLQuery,
  };
  const result = streamText({
    model: params.model.model,
    system: buildSystemPrompt({
      question: params.question,
      pageContext: params.pageContext,
    }),
    messages: params.messages,
    tools,
    toolChoice: "auto",
    stopWhen: stepCountIs(6),
    abortSignal: params.abortSignal,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const charts: unknown[] = [];
      const entityReferences: EntityReference[] = [];
      const queries: string[] = [];
      const toolSummaries: ToolSummary[] = [];
      let answer = "";
      let finishReason: string | null = null;
      let actualModelId = params.model.modelId;
      let upstreamProvider: string | undefined;
      let usage: StreamUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };

      controller.enqueue(
        encodeStreamLine({
          type: "init",
          conversationId: params.conversationId,
          remaining: params.remaining,
        }),
      );
      controller.enqueue(
        encodeStreamLine({
          type: "status",
          message: "Warming up the tyres...",
          stepType: "thinking",
        }),
      );

      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            answer += part.text;
            continue;
          }

          if (part.type === "error") throw part.error;
          if (part.type === "abort") throw new Error("Request cancelled");

          if (part.type === "tool-call") {
            const input = part.input as Record<string, unknown>;
            if (
              part.toolName === "run_sql_query" &&
              typeof input.sql === "string"
            ) {
              queries.push(input.sql);
            }
            const status = legacyToolStatus(part.toolName);
            if (status) {
              controller.enqueue(
                encodeStreamLine({ type: "status", ...status }),
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
            if (output.type === "chart") charts.push(output.config);
            if (Array.isArray(output.charts)) charts.push(...output.charts);
            entityReferences.push(...collectEntityReferences(output));
            if (part.toolName === "run_sql_query") {
              controller.enqueue(
                encodeStreamLine({
                  type: "status",
                  message: "Checking the final details...",
                  stepType: "thinking",
                }),
              );
            }
            continue;
          }

          if (part.type === "finish-step") {
            actualModelId = part.response.modelId ?? actualModelId;
            const { upstreamProvider: resolvedProvider, ...measured } =
              extractAIProviderUsage(part.providerMetadata);
            upstreamProvider = resolvedProvider ?? upstreamProvider;
            usage = { ...usage, ...measured };
            continue;
          }

          if (part.type === "finish") {
            finishReason = part.finishReason;
            usage = {
              ...usage,
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
            encodeStreamLine({
              type: "status",
              message: "Bringing it over the line...",
              stepType: "synthesizing",
            }),
          );
          const fallback = await buildFallbackAnswer({
            question: params.question,
            queries,
            toolSummaries,
            model: params.model.model,
            abortSignal: params.abortSignal,
            pageContext: params.pageContext,
          });
          if (fallback.trim()) {
            answer = answer.trim()
              ? `${answer.trim()}\n\n${fallback.trim()}`
              : fallback.trim();
          }
        }

        answer = presentAgentAnswer(answer, entityReferences);
        if (answer) {
          controller.enqueue(
            encodeStreamLine({ type: "text-delta", text: answer }),
          );
        }

        const followUps: string[] = [];
        if (!params.seedMode) {
          await saveConversationMessage(
            params.conversationId,
            "assistant",
            answer,
            {
              toolCalls: queries.length > 0 ? queries : undefined,
              toolResults: charts.length > 0 ? charts : undefined,
              tokensUsed: usage.totalTokens,
              model: actualModelId,
            },
          );
        }
        void writeCachedResponse(
          params.question,
          answer,
          charts,
          queries,
          followUps,
        );
        controller.enqueue(
          encodeStreamLine({
            type: "metadata",
            conversationId: params.conversationId,
            remaining: params.remaining,
            charts,
            queries,
            followUps,
            usage,
            model: {
              id: actualModelId,
              provider: params.model.provider,
              upstreamProvider,
            },
          }),
        );
      } catch (error) {
        Sentry.captureException(error);
        const message =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        controller.enqueue(
          encodeStreamLine({
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
}
