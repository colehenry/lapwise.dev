import type {
  AnalysisPageContext,
  PageSurface,
} from "@/lib/ai/analysis-contracts";
import type { DisplayMessage } from "@/lib/chatMessages";
import type { ResolvedScript, SurfaceDigest } from "./script";

/** A question a corner could not answer, carried to the dock with its trail. */
export type ClutchHandoff = {
  /** Distinguishes two hand-offs of the same question. */
  seq: number;
  question: string;
  /** The answers read on the way here, the one on screen last. */
  trail: ResolvedScript[];
  /** The panel's title, for the dock's caption and the model's context. */
  title: string;
  pageContext: AnalysisPageContext;
};

export function answerText(script: ResolvedScript): string {
  return script.segments.map((segment) => segment.text).join("");
}

/** The page context the dock sends: the page's ids plus the surface block. */
export function handoffPageContext(
  base: AnalysisPageContext,
  trail: ResolvedScript[],
  title: string,
  digest: SurfaceDigest | null,
): AnalysisPageContext {
  const current = trail[trail.length - 1];
  if (!digest || !current) return base;
  const surface: PageSurface = {
    id: current.id,
    title,
    digest,
    asked: trail.map((script) => ({
      question: script.question,
      answer: answerText(script),
    })),
  };
  return { ...base, surface };
}

/** The corner's exchanges, as the first turns of the dock's transcript. */
export function seededMessages(handoff: ClutchHandoff): DisplayMessage[] {
  return handoff.trail.flatMap((script, index) => [
    {
      id: `corner-q-${handoff.seq}-${index}`,
      role: "user" as const,
      content: script.question,
    },
    {
      id: `corner-a-${handoff.seq}-${index}`,
      role: "assistant" as const,
      content: answerText(script),
    },
  ]);
}

/** The follow-ups still worth offering once the thread is in the dock. */
export function remainingFollowups(handoff: ClutchHandoff): string[] {
  const current = handoff.trail[handoff.trail.length - 1];
  const asked = new Set(handoff.trail.map((script) => script.question));
  asked.add(handoff.question);
  return (current?.followups ?? [])
    .map((followup) => followup.question)
    .filter((question) => !asked.has(question));
}
