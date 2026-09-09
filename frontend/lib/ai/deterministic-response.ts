import * as Sentry from "@sentry/nextjs";
import type { DeterministicAnalysisResult } from "./analysis-engine";
import {
  saveConversationMessage,
  writeCachedResponse,
} from "./conversation-store";

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

function statusMessage(analysis: DeterministicAnalysisResult): string {
  const family = analysis.plan.facets[0]?.family;
  if (family === "qualifying_comparison") {
    return "Comparing the qualifying laps...";
  }
  if (family === "standings") return "Checking the championship picture...";
  if (family === "results") return "Checking the timing sheets...";
  return "Piecing the race together...";
}

export function createDeterministicAnalysisResponse(params: {
  analysis: DeterministicAnalysisResult;
  conversationId: string;
  question: string;
  remaining: number | null;
  seedMode: boolean;
}): Response {
  const { analysis, conversationId, question, remaining, seedMode } = params;
  const followUps = buildFollowUp(analysis);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encodeStreamLine({ type: "init", conversationId, remaining }),
      );
      controller.enqueue(
        encodeStreamLine({
          type: "status",
          message: statusMessage(analysis),
          stepType: "thinking",
        }),
      );
      controller.enqueue(
        encodeStreamLine({ type: "text-delta", text: analysis.markdown }),
      );

      try {
        if (!seedMode) {
          await saveConversationMessage(
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
      } catch (error) {
        Sentry.captureException(error);
        controller.enqueue(
          encodeStreamLine({
            type: "error",
            error:
              "The analysis completed, but its conversation could not be saved.",
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
