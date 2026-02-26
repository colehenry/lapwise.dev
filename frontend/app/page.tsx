import Link from "next/link";
import LatestRaceWeekend from "@/components/LatestRaceWeekend";
import NextRaceBanner from "@/components/NextRaceBanner";
import { GridPattern } from "@/components/Patterns";
import TiltCard from "@/components/ui/TiltCard";

function CrosshairPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.05] pointer-events-none"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <title>Crosshair pattern</title>
      <circle
        cx="200"
        cy="150"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <circle
        cx="200"
        cy="150"
        r="80"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
      />
      <circle
        cx="200"
        cy="150"
        r="120"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.3"
      />
      <line
        x1="0"
        y1="150"
        x2="400"
        y2="150"
        stroke="currentColor"
        strokeWidth="0.3"
      />
      <line
        x1="200"
        y1="0"
        x2="200"
        y2="300"
        stroke="currentColor"
        strokeWidth="0.3"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="bg-bg-primary">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-bg-secondary min-h-[70vh] flex items-center">
        <GridPattern
          id="hero-grid"
          className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.06] pointer-events-none"
        />

        {/* Subtle glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-purple-500 rounded-full blur-[160px] opacity-15" />
          <div className="absolute bottom-1/4 left-1/3 w-48 h-48 bg-red-500 rounded-full blur-[120px] opacity-10" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 w-full">
          <div className="space-y-6">
            {/* System label */}
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                Formula 1 Analytics Platform
              </span>
            </div>

            {/* Title */}
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              <span className="text-purple-400">Lap</span>
              <span className="text-text-primary">wise</span>
            </h1>

            {/* Tagline */}
            <p className="text-lg md:text-xl text-text-tertiary max-w-xl leading-relaxed">
              Every race, every lap, every millisecond — from 1950 to today.
            </p>

            {/* CTA */}
            <div className="flex items-center gap-4 pt-4">
              <Link
                href="/results"
                className="inline-flex items-center gap-2 bg-purple-500/15 border border-purple-500 text-purple-300 font-mono text-sm font-bold tracking-widest uppercase px-6 py-3 rounded-sm hover:bg-purple-500/25 transition-colors duration-150"
              >
                Explore Results
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <title>Arrow right</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-8 pt-8 border-t border-border-primary mt-8">
              <div>
                <p className="text-2xl font-bold text-purple-400 font-mono">
                  74+
                </p>
                <p className="text-[10px] text-text-muted tracking-widest uppercase font-mono font-bold">
                  Seasons
                </p>
              </div>
              <div className="w-px h-8 bg-border-primary" />
              <div>
                <p className="text-2xl font-bold text-purple-400 font-mono">
                  1000+
                </p>
                <p className="text-[10px] text-text-muted tracking-widest uppercase font-mono font-bold">
                  Races
                </p>
              </div>
              <div className="w-px h-8 bg-border-primary" />
              <div>
                <p className="text-2xl font-bold text-purple-400 font-mono">
                  Live
                </p>
                <p className="text-[10px] text-text-muted tracking-widest uppercase font-mono font-bold">
                  Telemetry
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Next Race Banner */}
      <NextRaceBanner />

      {/* Latest Race Weekend */}
      <LatestRaceWeekend />

      {/* Feature Cards */}
      <section className="bg-bg-secondary py-16 px-6 border-y border-border-primary/60">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: "Standings",
                desc: "Driver and constructor championship standings with points breakdowns.",
                href: "/results",
                icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
              },
              {
                label: "Telemetry",
                desc: "Lap times, sector performance, and session telemetry analysis.",
                href: "/results",
                icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
              },
              {
                label: "Driver Profiles",
                desc: "Career statistics and race histories for every F1 driver.",
                href: "/drivers",
                icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
              },
            ].map((feature) => (
              <TiltCard key={feature.label}>
                <Link
                  href={feature.href}
                  className="block group bg-bg-tertiary border border-border-primary rounded-sm p-0 hover:border-purple-500/70 transition-all duration-150 relative overflow-hidden h-full"
                >
                  <CrosshairPattern />
                  <div className="relative z-10">
                    <div className="relative h-10 bg-bg-secondary border-b border-border-primary px-4 flex items-center overflow-hidden">
                      <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                        Feature
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="w-10 h-10 rounded-sm bg-purple-500/12 border border-purple-500/30 flex items-center justify-center mb-3">
                        <svg
                          className="w-5 h-5 text-purple-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <title>{feature.label}</title>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d={feature.icon}
                          />
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold text-text-primary tracking-tight mb-1.5">
                        {feature.label}
                      </h3>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                </Link>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
