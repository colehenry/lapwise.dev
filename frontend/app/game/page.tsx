import type { Metadata } from "next";
import { GridPattern } from "@/components/layout/Patterns";
import Container from "@/components/ui/Container";
import DailyGameGrid from "./DailyGameGrid";

export const metadata: Metadata = {
  title: "Daily F1 Grid | Lapwise",
  description:
    "Find the Formula 1 driver who connects each pair of categories in the Lapwise daily grid.",
};

export default function GamePage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="relative overflow-hidden border-b border-border-primary bg-bg-secondary">
        <GridPattern
          id="game-page-grid"
          className="pointer-events-none absolute inset-0 h-full w-full text-purple-500 opacity-[0.06]"
        />
        <div className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-purple-500/10 blur-[100px]" />

        <Container className="relative py-10 sm:py-14">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                  Daily Formula 1 challenge
                </p>
              </div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-text-primary sm:text-6xl">
                Lapwise <span className="text-purple-400">Grid</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-tertiary sm:text-base">
                Nine squares. Nine submissions. Connect constructors,
                nationalities, eras, achievements, and race history.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start rounded-sm border border-border-primary bg-bg-primary/70 px-4 py-3 sm:self-auto">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-muted">
                  Next grid
                </p>
                <p className="mt-0.5 text-sm font-semibold text-text-primary">
                  Daily at 00:00 UTC
                </p>
              </div>
              <span className="h-8 w-px bg-border-primary" />
              <span className="rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-warning">
                Playable
              </span>
            </div>
          </div>
        </Container>
      </header>

      <Container className="py-8 sm:py-10">
        <DailyGameGrid />

        <section className="mt-10 border-t border-border-primary pt-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [
                "Three-answer floor",
                "Every standard square is checked for at least three valid drivers.",
              ],
              [
                "One driver once",
                "A correct name locks to its square and cannot be reused elsewhere.",
              ],
              [
                "Built from Lapwise data",
                "Published boards preserve their accepted answers when source data changes.",
              ],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-sm border border-border-primary bg-bg-secondary p-5"
              >
                <h2 className="text-sm font-bold text-text-primary">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </Container>
    </div>
  );
}
