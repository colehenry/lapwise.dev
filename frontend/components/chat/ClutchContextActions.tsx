import Link from "next/link";
import type { AnalysisPageContext } from "@/lib/ai/analysis-contracts";
import { buildClutchHref } from "@/lib/ai/clutch-links";
import ClutchIcon from "../ui/ClutchIcon";

interface ClutchAction {
  label: string;
  question: string;
}

interface ClutchContextActionsProps {
  context: AnalysisPageContext;
  actions: ClutchAction[];
  compact?: boolean;
}

export default function ClutchContextActions({
  context,
  actions,
  compact = false,
}: ClutchContextActionsProps) {
  return (
    <nav
      aria-label="Ask Clutch about this page"
      className={`flex flex-wrap items-center gap-2 ${compact ? "" : "rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface-soft)] p-3"}`}
    >
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-purple-300">
        <ClutchIcon className="h-4 w-4" />
        Ask Clutch
      </span>
      {actions.map((action) => (
        <Link
          key={action.label}
          href={buildClutchHref(action.question, context)}
          className="rounded-lg border border-border-primary bg-bg-primary px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide text-text-secondary transition-colors hover:border-purple-500/40 hover:text-purple-300"
        >
          {action.label}
        </Link>
      ))}
    </nav>
  );
}
