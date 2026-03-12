import Link from "next/link";
import HomeDiscussionSection from "@/components/home/HomeDiscussionSection";
import SeasonRoundSelector from "@/components/home/SeasonRoundSelector";
import TopRightLatestRace from "@/components/home/TopRightLatestRace";
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

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 w-full">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
            {/* Left Column: Branding & Selector */}
            <div className="space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                    Formula 1 Analytics Platform
                  </span>
                </div>

                <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter">
                  <span className="text-purple-400">Lap</span>
                  <span className="text-text-primary">wise</span>
                </h1>
              </div>

              <div className="space-y-4 pt-4">
                <p className="text-[10px] text-text-muted tracking-widest uppercase font-mono font-bold">
                  Jump to Results
                </p>
                <SeasonRoundSelector />
              </div>
            </div>

            {/* Right Column: Latest Race Card */}
            <div className="hidden lg:block shrink-0">
              <TopRightLatestRace />
            </div>
          </div>
        </div>
      </section>

      {/* Next Race Banner */}
      <NextRaceBanner />

      {/* Mobile-only Latest Race Card (shows after banner on small screens) */}
      <div className="lg:hidden px-6 py-8 bg-bg-primary border-b border-border-primary/40">
        <TopRightLatestRace />
      </div>

      {/* Feature Cards */}
      <section className="bg-bg-secondary py-20 px-6 border-y border-border-primary/60">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Database
                </span>
              </div>
              <h2 className="text-3xl font-bold text-text-primary tracking-tight">
                Explore the Archive
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: "Drivers",
                desc: "Career statistics, race histories, and head-to-head comparisons for every driver.",
                href: "/drivers",
                icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
              },
              {
                label: "Constructors",
                desc: "Technical history and performance data for every team to ever compete.",
                href: "/constructors",
                icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
              },
              {
                label: "Circuits",
                desc: "Track maps, layout changes, and historical records for every F1 venue.",
                href: "/circuits",
                icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
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
                        Explore
                      </span>
                    </div>
                    <div className="p-6">
                      <div className="w-10 h-10 rounded-sm bg-purple-500/12 border border-purple-500/30 flex items-center justify-center mb-4">
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
                      <h3 className="text-lg font-bold text-text-primary tracking-tight mb-2">
                        {feature.label}
                      </h3>
                      <p className="text-sm text-text-secondary leading-relaxed mb-6">
                        {feature.desc}
                      </p>
                      <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-purple-400 group-hover:text-purple-300 transition-colors">
                        Explore {feature.label}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
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
