import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Community Rules · Lapwise",
  description: "Rules and expectations for the Lapwise F1 community.",
};

function Rule({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-sm bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
        <span className="text-xs font-bold font-mono text-purple-400">
          {number}
        </span>
      </div>
      <div className="flex-1 pt-1 space-y-1.5">
        <h3 className="font-semibold text-text-primary">{title}</h3>
        <div className="text-sm text-text-secondary leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function RulesPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
            Community
          </span>
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-3">
          Community Rules
        </h1>
        <p className="text-text-secondary">
          Lapwise is a place for serious F1 discussion backed by data. These
          rules exist to keep it useful and worth reading.
        </p>
      </div>

      <div className="space-y-6">
        <Rule number={1} title="Back up claims with data or sources">
          If you say a driver underperformed, show a lap time or sector
          comparison. If you cite a strategy call, link to the session or
          reference the data. Opinion is fine; unsubstantiated assertion is not.
          Lapwise has the tools — use them.
        </Rule>

        <Rule number={2} title="No spam, self-promotion, or off-topic posts">
          Don't post to promote an unrelated account, product, or community.
          Keep discussions about F1. Repeated off-topic posts will be removed.
        </Rule>

        <Rule number={3} title="No harassment or personal attacks">
          Disagree with the analysis, not the person. Insults, targeted
          harassment, and threats will result in immediate account action.
          Critique the argument — not the poster.
        </Rule>

        <Rule number={4} title="Source your data">
          When embedding charts, quoting lap times, or referencing historical
          results, note your source — Lapwise data, FastF1, official timing, or
          other. Don't present fabricated or estimated numbers as fact.
        </Rule>

        <Rule number={5} title="No duplicate or low-effort posts">
          Check if the topic has already been discussed. Single-sentence posts
          that don't contribute anything — "lol Hamilton" — will be removed. Use
          the reply function instead.
        </Rule>

        <Rule number={6} title="Follow Lapwise's Terms of Service">
          All community activity is subject to the{" "}
          <Link
            href="/terms"
            className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
          >
            Terms of Service
          </Link>
          . Accounts that repeatedly violate these rules will be deactivated.
        </Rule>
      </div>

      <div className="border border-border-primary rounded-sm bg-bg-secondary p-5 space-y-2">
        <p className="text-sm font-semibold text-text-primary">
          Reporting a violation
        </p>
        <p className="text-sm text-text-secondary">
          If you see a post or comment that breaks these rules, use the report
          function or contact{" "}
          <a
            href="mailto:support@lapwise.dev"
            className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
          >
            support@lapwise.dev
          </a>
          . We aim to respond quickly.
        </p>
      </div>
    </div>
  );
}
