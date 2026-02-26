import Link from "next/link";
import { GridPattern } from "@/components/Patterns";

export const metadata = {
  title: "About Lapwise",
  description:
    "What you can do on Lapwise today and what is planned next for the site.",
};

const availableNow = [
  {
    title: "Race weekend results",
    description:
      "See race, qualifying, sprint, strategy, and analysis tabs with lap-level detail.",
    href: "/results",
  },
  {
    title: "Driver pages",
    description: "Browse career stats, season history, and race results by driver.",
    href: "/drivers",
  },
  {
    title: "Constructor pages",
    description: "Compare teams by season performance, points, and race outcomes.",
    href: "/constructors",
  },
  {
    title: "Circuit pages",
    description:
      "Check track basics, locations, and race history for each circuit.",
    href: "/circuits",
  },
];

const nextUp = [
  "Richer driver, team, and circuit pages with deeper history and comparisons.",
  "A full calendar page with countdowns, upcoming race info, and links to each weekend.",
  "Head-to-head comparisons for drivers and teams.",
  "A stats and records page for all-time and season milestones.",
  "Live race tools during race weekends, including fast refresh and race control updates.",
  "Short race recap posts to keep the site active between weekends.",
];

export default function AboutPage() {
  return (
    <div className="bg-bg-primary">
      <section className="relative overflow-hidden bg-bg-secondary min-h-[55vh] flex items-center">
        <GridPattern
          id="about-grid"
          className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.06] pointer-events-none"
        />

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-purple-500 rounded-full blur-[160px] opacity-15" />
          <div className="absolute bottom-1/4 left-1/3 w-48 h-48 bg-red-500 rounded-full blur-[120px] opacity-10" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 w-full">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                About Lapwise
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-text-primary">
              A simple way to explore F1 history and race weekends
            </h1>

            <p className="text-lg text-text-tertiary leading-relaxed">
              Lapwise is built for fans who want race context quickly: who was
              fast, where positions changed, and how weekends played out.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-bg-primary py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary">
              What you can do now
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableNow.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="block bg-bg-tertiary border border-border-primary rounded-sm p-5 hover:border-purple-500 hover:shadow-purple transition-all duration-150"
              >
                <h3 className="text-sm font-semibold text-text-primary tracking-wide mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-bg-secondary py-16 px-6 border-y border-border-primary">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary">
              What&apos;s next
            </h2>
            <p className="text-sm text-text-muted mt-3 max-w-3xl">
              These are the next major upgrades planned in docs/ROADMAP.md.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nextUp.map((item) => (
              <div
                key={item}
                className="flex gap-3 bg-bg-primary border border-border-primary rounded-sm p-4"
              >
                <span className="mt-2 w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                <p className="text-sm text-text-secondary leading-relaxed">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-bg-primary py-14 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-4">
          <Link
            href="/results"
            className="inline-flex items-center justify-center gap-2 bg-purple-500/15 border border-purple-500 text-purple-300 font-mono text-sm font-bold tracking-widest uppercase px-6 py-3 rounded-sm hover:bg-purple-500/25 transition-colors duration-150"
          >
            Open Race Hub
          </Link>
          <Link
            href="/drivers"
            className="inline-flex items-center justify-center gap-2 bg-bg-tertiary border border-border-primary text-text-secondary font-mono text-sm font-bold tracking-widest uppercase px-6 py-3 rounded-sm hover:border-purple-500 transition-colors duration-150"
          >
            Browse Drivers
          </Link>
        </div>
      </section>
    </div>
  );
}
