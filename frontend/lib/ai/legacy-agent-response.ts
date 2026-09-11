import * as Sentry from "@sentry/nextjs";
import { stepCountIs, streamText } from "ai";
import {
  AGENT_MAX_OUTPUT_TOKENS,
  AGENT_MAX_STEPS,
  AGENT_STEP_TIMEOUT_MS,
  AGENT_TOTAL_TIMEOUT_MS,
  shouldForceFinalAnswer,
} from "./agent-budget";
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
  agentErrorStage,
  agentOutcomeStatus,
  publicAgentErrorMessage,
  requireAgentAnswer,
} from "./legacy-agent-outcome";
import { agentToolProgress } from "./legacy-agent-support";
import { type AIModelSelection, extractAIProviderUsage } from "./provider";
import type { RequestLog } from "./request-log";
import { getSeasonContext } from "./season-context-tool";
import { buildSystemPrompt, selectPromptKnowledge } from "./system-prompt";
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
  log: RequestLog;
}): Promise<Response> {
  const { log } = params;
  log.path = "agent";
  const knowledge = selectPromptKnowledge(params.question);
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
    maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS,
    maxRetries: 1,
    timeout: {
      totalMs: AGENT_TOTAL_TIMEOUT_MS,
      stepMs: AGENT_STEP_TIMEOUT_MS,
    },
    stopWhen: stepCountIs(AGENT_MAX_STEPS),
    prepareStep: ({ steps, stepNumber }) =>
      shouldForceFinalAnswer(steps, stepNumber)
        ? { toolChoice: "none", activeTools: [] }
        : undefined,
    abortSignal: params.abortSignal,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const charts: unknown[] = [];
      const entityReferences: EntityReference[] = [];
      const queries: string[] = [];
      const toolCalls: { tool: string; sql?: string }[] = [];
      let answer = "";
      let actualModelId = params.model.modelId;
      let upstreamProvider: string | undefined;
      let usage: StreamUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
      let steps = 0;
      let finishReason: string | undefined;
      const modelStartedAt = performance.now();
      let modelMs: number | undefined;
      const logDetails = () => ({
        analysisModel: actualModelId,
        upstreamProvider,
        knowledgeNodes: knowledge.nodes.map((node) => node.id),
        topics: knowledge.topics,
        usage,
        steps,
        sqlCalls: queries.length,
        toolCalls,
        modelMs,
        finishReason,
      });

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
          stage: "starting",
        }),
      );

      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            log.markFirstToken();
            answer += part.text;
            continue;
          }

          if (part.type === "error") throw part.error;
          if (part.type === "tool-error") throw part.error;
          if (part.type === "abort") throw new Error("Request cancelled");

          if (part.type === "tool-call") {
            const input = part.input as Record<string, unknown>;
            if (
              part.toolName === "run_sql_query" &&
              typeof input.sql === "string"
            ) {
              queries.push(input.sql);
              toolCalls.push({ tool: part.toolName, sql: input.sql });
            } else {
              toolCalls.push({ tool: part.toolName });
            }
            const progress = agentToolProgress(part.toolName);
            if (progress) {
              controller.enqueue(
                encodeStreamLine({ type: "status", ...progress }),
              );
            }
            continue;
          }

          if (part.type === "tool-result") {
            const output = part.output as Record<string, unknown>;
            if (output.type === "chart") charts.push(output.config);
            if (Array.isArray(output.charts)) charts.push(...output.charts);
            entityReferences.push(...collectEntityReferences(output));
            const progress = agentToolProgress(part.toolName, output);
            if (progress?.metrics) {
              controller.enqueue(
                encodeStreamLine({
                  type: "status",
                  ...progress,
                }),
              );
            }
            continue;
          }

          if (part.type === "finish-step") {
            steps += 1;
            actualModelId = part.response.modelId ?? actualModelId;
            const { upstreamProvider: resolvedProvider, ...measured } =
              extractAIProviderUsage(part.providerMetadata);
            upstreamProvider = resolvedProvider ?? upstreamProvider;
            usage = { ...usage, ...measured };
            continue;
          }

          if (part.type === "finish") {
            finishReason = part.finishReason;
            modelMs = Math.round(performance.now() - modelStartedAt);
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

        answer = requireAgentAnswer(
          presentAgentAnswer(answer, entityReferences),
        );
        if (answer) {
          controller.enqueue(
            encodeStreamLine({ type: "text-delta", text: answer }),
          );
        }

        const followUps: string[] = [];
        let messageId: string | null = null;
        if (!params.seedMode) {
          messageId = await saveConversationMessage(
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
        await log.finish({
          status: "ok",
          httpStatus: 200,
          messageId,
          ...logDetails(),
        });
      } catch (error) {
        Sentry.captureException(error);
        controller.enqueue(
          encodeStreamLine({
            type: "error",
            error: publicAgentErrorMessage(error),
          }),
        );
        await log.finish({
          status: agentOutcomeStatus(error),
          stage: agentErrorStage(error),
          httpStatus: 200,
          error,
          ...logDetails(),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
