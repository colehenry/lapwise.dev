import * as Sentry from "@sentry/nextjs";
import type { ClutchProgressStage } from "../clutch-progress";
import type { DeterministicAnalysisResult } from "./analysis-engine";
import {
  saveConversationMessage,
  writeCachedResponse,
} from "./conversation-store";
import type { RequestLog } from "./request-log";

export function encodeStreamLine(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
}

function buildFollowUp(analysis: DeterministicAnalysisResult): string[] {
  const drivers = analysis.plan.entities.filter(
    (entity) => entity.kind === "driver",
  );
  const season = analysis.plan.scope.season;
  if (drivers.length !== 2 || !season) return [];
  return [
    `How did ${drivers[0].name} and ${drivers[1].name} compare on race day in ${season}?`,
  ];
}

function progressStage(
  analysis: DeterministicAnalysisResult,
): ClutchProgressStage {
  const family = analysis.plan.facets[0]?.family;
  if (family === "qualifying_comparison") return "qualifying";
  if (family === "standings") return "season";
  if (family === "results") return "results";
  if (family === "weather") return "weather";
  if (family === "strategy") return "strategy";
  if (family === "race_narrative") return "race";
  if (family === "rules") return "rules";
  return "planning";
}

export function createDeterministicAnalysisResponse(params: {
  analysis: DeterministicAnalysisResult;
  conversationId: string;
  question: string;
  remaining: number | null;
  seedMode: boolean;
  log: RequestLog;
}): Response {
  const { analysis, conversationId, question, remaining, seedMode, log } =
    params;
  const followUps = buildFollowUp(analysis);
  log.path = "deterministic";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encodeStreamLine({ type: "init", conversationId, remaining }),
      );
      controller.enqueue(
        encodeStreamLine({
          type: "status",
          stage: progressStage(analysis),
        }),
      );
      controller.enqueue(
        encodeStreamLine({ type: "text-delta", text: analysis.markdown }),
      );
      log.markFirstToken();

      let messageId: string | null = null;
      try {
        if (!seedMode) {
          messageId = await saveConversationMessage(
            conversationId,
            "assistant",
            analysis.markdown,
            {
              toolCalls: analysis.queries,
              toolResults: analysis.charts,
              tokensUsed: 0,
              model: analysis.model,
            },
          );
        }
        void writeCachedResponse(
          question,
          analysis.markdown,
          analysis.charts,
          analysis.queries,
          followUps,
        );

        controller.enqueue(
          encodeStreamLine({
            type: "metadata",
            conversationId,
            remaining,
            charts: analysis.charts,
            queries: analysis.queries,
            followUps,
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            model: { id: analysis.model, provider: "deterministic" },
            plan: analysis.plan,
          }),
        );
        await log.finish({
          status: "ok",
          httpStatus: 200,
          messageId,
          analysisModel: analysis.model,
          sqlCalls: analysis.queries.length,
        });
      } catch (error) {
        Sentry.captureException(error);
        controller.enqueue(
          encodeStreamLine({
            type: "error",
            error:
              "The analysis completed, but its conversation could not be saved.",
          }),
        );
        await log.finish({
          status: "error",
          stage: "persist",
          httpStatus: 200,
          error,
          analysisModel: analysis.model,
          sqlCalls: analysis.queries.length,
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
