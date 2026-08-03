import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";

export const metadata = {
  title: "About Lapwise",
  description:
    "A guide to what you can do on Lapwise: 76 years of F1 race results, driver and constructor profiles, telemetry, race comments, AI analysis, and race replays.",
};

interface Feature {
  label: string;
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
}

const features: Feature[] = [
  {
    label: "01",
    title: "Race Results & Standings",
    description:
      "Browse every Formula 1 season from 1950 to today. Full race, qualifying, and sprint results, plus driver and constructor standings for every championship year.",
    href: "/results",
    hrefLabel: "Results",
  },
  {
    label: "02",
    title: "Driver Profiles",
    description:
      "Career totals, season-by-season points progression, and complete race-by-race history for every driver who has ever started a Grand Prix.",
    href: "/drivers",
    hrefLabel: "Drivers",
  },
  {
    label: "03",
    title: "Constructor Profiles",
    description:
      "See how every team has performed across the decades, with career stats, championship history, and a full list of every race they've entered.",
    href: "/constructors",
    hrefLabel: "Constructors",
  },
  {
    label: "04",
    title: "Circuits",
    description:
      "Track maps, circuit information, and historical results for every venue on the F1 calendar, past and present.",
    href: "/circuits",
    hrefLabel: "Circuits",
  },
  {
    label: "05",
    title: "Telemetry & Race Pace",
    description:
      "Lap time distributions, race pace charts, and position changes built from real session data, so you can actually see how a race played out.",
  },
  {
    label: "06",
    title: "Race Replay",
    description:
      "Watch animated replays of full races with driver positions on the track map, a live leaderboard, and telemetry comparisons between cars.",
  },
  {
    label: "07",
    title: "Ask Clutch",
    description:
      "Ask Clutch, our AI analyst, questions about Formula 1 in plain English and get answers with strategy breakdowns, data tables, and interactive charts pulled straight from the database.",
  },
  {
    label: "08",
    title: "Race Comments",
    description:
      "Every race weekend has its own comment thread on the round page, with replies, voting, and markdown support.",
    href: "/results",
    hrefLabel: "Results",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg-secondary">
      <PageHeader title="About" subtitle="What Lapwise Is" />

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Intro */}
        <section className="relative border border-border-primary bg-bg-tertiary rounded-sm p-6 md:p-10 overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 right-1/4 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl" />
            <div className="absolute -bottom-20 left-1/4 w-56 h-56 rounded-full bg-red-500/10 blur-3xl" />
          </div>
          <div className="relative">
            <div className="text-[10px] text-purple-400 font-mono tracking-widest uppercase mb-3">
              {"// Lapwise.dev"}
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-text-primary leading-tight">
              Formula 1 analytics
              <br />
              for every race since 1950.
            </h1>
            <p className="mt-6 text-sm md:text-base text-text-secondary leading-7 md:leading-8 max-w-2xl">
              Lapwise is a home for Formula 1 fans who want more than a
              headline. Dig into 76 years of race history, compare drivers and
              teams across eras, watch animated race replays, break down
              telemetry from any session, and talk it all through with other
              fans — all in one place.
            </p>
            <p className="mt-4 text-sm md:text-base text-text-secondary leading-7 md:leading-8 max-w-2xl">
              This page is a quick guide to what you can do on the site.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between mb-4">
            <div className="text-[10px] text-text-muted font-mono tracking-widest uppercase">
              {"// What you can do"}
            </div>
            <div className="text-[10px] text-text-muted font-mono tracking-widest uppercase">
              {features.length} sections
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((feature) => {
              const body = (
                <>
                  <div className="flex items-start gap-3">
                    <span className="text-[10px] text-purple-400 font-mono tracking-widest mt-1">
                      {feature.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-text-primary font-bold text-base">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-sm text-text-secondary leading-6">
                        {feature.description}
                      </p>
                      {feature.href && feature.hrefLabel && (
                        <div className="mt-3 text-[10px] text-purple-300 font-mono tracking-widest uppercase">
                          → {feature.hrefLabel}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
              return feature.href ? (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="block h-full border border-border-primary bg-bg-tertiary rounded-sm p-5 hover:border-purple-500 transition-colors duration-200"
                >
                  {body}
                </Link>
              ) : (
                <div
                  key={feature.title}
                  className="h-full border border-border-primary bg-bg-tertiary rounded-sm p-5"
                >
                  {body}
                </div>
              );
            })}
          </div>
        </section>

        {/* Feedback & Support */}
        <section className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-border-primary bg-bg-tertiary rounded-sm p-5">
            <div className="text-[10px] text-purple-400 font-mono tracking-widest uppercase mb-3">
              {"// Feedback"}
            </div>
            <h3 className="text-text-primary font-bold text-base">
              Actively developed
            </h3>
            <p className="mt-2 text-sm text-text-secondary leading-6">
              Lapwise is actively being developed and I'm always open to
              suggestions, feature ideas, and feedback. Feel free to{" "}
              <a
                href="https://github.com/colehenry/lapwise.dev/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-300 hover:text-purple-200 underline underline-offset-4"
              >
                open an issue
              </a>{" "}
              or reach out directly.
            </p>
          </div>
          <div className="border border-border-primary bg-bg-tertiary rounded-sm p-5">
            <div className="text-[10px] text-purple-400 font-mono tracking-widest uppercase mb-3">
              {"// Support"}
            </div>
            <h3 className="text-text-primary font-bold text-base">
              Back the project
            </h3>
            <p className="mt-2 text-sm text-text-secondary leading-6">
              If you enjoy Lapwise and want to support development, you can{" "}
              <a
                href="https://buymeacoffee.com/colehenry"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-300 hover:text-purple-200 underline underline-offset-4"
              >
                buy me a coffee
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
