/**
 * Classifies how an agent run ended: the message the user sees and the
 * status/stage the request ledger records.
 */

import type { RequestLogStage } from "./request-log";

export function publicAgentErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  if (
    /abort/i.test(name) ||
    /timeout|timed out|deadline|aborted/i.test(message)
  ) {
    return "Clutch ran out of time while building that answer. Please try again.";
  }
  if (/without an answer|no content|length/i.test(message)) {
    return "Clutch couldn't finish that answer. Please try again—the next run will start fresh.";
  }
  return "Clutch hit a problem while building that answer. Please try again.";
}

export function requireAgentAnswer(answer: string): string {
  if (!answer.trim()) throw new Error("Model completed without an answer");
  return answer;
}

export function agentErrorStage(error: unknown): RequestLogStage {
  const message = error instanceof Error ? error.message : String(error);
  return /without an answer/i.test(message) ? "stream" : "model";
}

export function agentOutcomeStatus(error: unknown): "aborted" | "error" {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  return /abort/i.test(name) || /cancelled/i.test(message)
    ? "aborted"
    : "error";
}
