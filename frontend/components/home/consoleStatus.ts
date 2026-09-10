/** Track-status and feed-event codes, each pointing at its data token. */
const STATUS_TOKENS: Record<string, string> = {
  yellow: "var(--status-yellow)",
  sc: "var(--status-sc)",
  vsc: "var(--status-vsc)",
  red: "var(--status-red)",
  pit: "var(--status-pit)",
  out: "var(--status-red)",
  fast: "var(--status-fastest)",
  steward: "var(--status-steward)",
};

export function statusColor(code: string): string {
  return STATUS_TOKENS[code] ?? "var(--delta-neutral)";
}

/**
 * The running order sits directly above the feed and already says who leads,
 * so a lead-change line would only repeat it.
 */
export const HIDDEN_FEED_KINDS = new Set(["lead"]);
