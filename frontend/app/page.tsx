import Link from "next/link";
import AIAnalystPreview from "@/components/home/AIAnalystPreview";
import LiveReplayPreview from "@/components/home/LiveReplayPreview";
import SeasonRoundSelector from "@/components/home/SeasonRoundSelector";
import TopRightLatestRace from "@/components/home/TopRightLatestRace";
import NextRaceBanner from "@/components/NextRaceBanner";
import { GridPattern } from "@/components/Patterns";
import TiltCard from "@/components/ui/TiltCard";

function FeatureIcon({ label }: { label: string }) {
  const className = "w-6 h-6 text-purple-400";

  if (label === "Drivers") {
    return (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        fill="none"
        stroke="currentColor"
        strokeWidth={28}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Drivers</title>
        <path d="M40 280 A200 200 0 0 1 440 280 L440 360 A60 60 0 0 1 360 420 L100 360 A60 60 0 0 1 40 300 Z" />
        <path d="M260 230 L440 250 L440 400 L260 300 Z" />
        <circle cx="130" cy="270" r="45" />
      </svg>
    );
  }

  if (label === "Constructors") {
    return (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <title>Constructors</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
        />
      </svg>
    );
  }

  if (label === "Circuits") {
    return (
      <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 431.76266 282.2795"
        fill="none"
        stroke="currentColor"
        strokeWidth={18}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <title>Circuits</title>
        <path d="m4.0167 271.88c0.64631 8.2948 35.488 7.0412 175.53 4.453 12.377-0.22874 23.86-0.27059 25.52-0.0932 13.322 1.4247 100.54 2.2285 145.19 1.3382l52.003-1.0371 10.787-5.1931c5.9327-2.8564 11.75-6.3558 12.928-7.7758 3.9507-4.7641 3.2062-6.3707-21.921-47.254-13.094-21.305-31.084-50.583-39.976-65.064-78.47-127.81-76.73-125.33-87.73-124.85-10.071 0.43333-18.612 11.049-30.86 38.362-6.0647 12.461-9.3595 17.392-9.4458 30.499-0.16791 25.024 10.566 36.802 43.884 48.15 27.605 9.4028 44.83 34.219 37.75 54.389-2.9794 8.4869-5.7122 8.9248-56.109 8.9963-116.27 0.16506-159.78-0.95414-191.07-4.9201-0.01764-0.002-0.0317-0.005-0.04921-0.008-1.3307-0.66808-2.43-1.5305-2.9028-2.6746 0.52921-1.7786 2.7076-4.7102 6.8088-9.6375 12.941-15.548 12.809-15.542 95.728-5.2995 57.897 7.1518 61.142 0.92171 16.441-31.574-40.6-29.52-40.53-29.42-36.96-49.77 3.4-19.413-0.73-26.128-20.45-33.214-14.94-5.372-30.31-18.671-50.912-44.055-23.312-28.723-35.64-28.862-40.096-0.451-16.672 106.31-23.197 153.18-23.266 178.19-0.10452 1.6859-0.07039 3.3487 0.08572 4.9912 0.31161 8.3078 1.4916 13.926 3.3599 18.797 7.4095 19.318 7.6168 17.58-3.5718 30.076-5.9649 6.6621-10.949 11.37-10.696 14.616z" />
      </svg>
    );
  }

  return null;
}

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
      <section className="relative overflow-hidden bg-bg-secondary">
        <GridPattern
          id="hero-grid"
          className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.06] pointer-events-none"
        />

        {/* Subtle glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-purple-500 rounded-full blur-[160px] opacity-15" />
          <div className="absolute bottom-1/4 left-1/3 w-48 h-48 bg-red-500 rounded-full blur-[120px] opacity-10" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-10 md:px-6 md:py-16 lg:py-20 w-full">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 lg:gap-12">
            {/* Left Column: Branding & Selector */}
            <div className="space-y-6 md:space-y-8 lg:space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                  <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                    Formula 1 Data · Replay · AI Analysis
                  </span>
                </div>

                <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter">
                  <span className="text-purple-400">Lap</span>
                  <span className="text-text-primary">wise</span>
                </h1>

                <p className="text-xs text-text-muted tracking-widest uppercase font-medium">
                  Charts, telemetry, replay, and analysis for every race
                </p>
              </div>

              <div className="lg:hidden">
                <TopRightLatestRace />
              </div>

              <div className="space-y-4 lg:pt-4">
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

      {/* Live Replay Preview */}
      <LiveReplayPreview />

      {/* AI Analyst Preview */}
      <AIAnalystPreview />

      {/* Next Race Banner */}
      <NextRaceBanner />

      {/* Feature Cards */}
      <section className="bg-bg-secondary py-14 px-4 md:px-6 border-y border-border-primary/60">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
                  Database
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
                Explore the Archive
              </h2>
            </div>
          </div>

          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
            {[
              {
                label: "Drivers",
                desc: "Career statistics, race histories, and head-to-head comparisons.",
                href: "/drivers",
              },
              {
                label: "Constructors",
                desc: "Technical history and performance data for every team.",
                href: "/constructors",
              },
              {
                label: "Circuits",
                desc: "Track maps, layout changes, and historical records.",
                href: "/circuits",
              },
            ].map((feature) => (
              <TiltCard key={feature.label}>
                <Link
                  href={feature.href}
                  className="block group bg-bg-tertiary border border-border-primary rounded-sm hover:border-purple-500/70 transition-all duration-150 relative overflow-hidden h-full"
                >
                  <CrosshairPattern />
                  <div className="relative z-10 flex flex-col items-center text-center p-5 md:p-6">
                    <div className="w-11 h-11 rounded-sm bg-purple-500/10 border border-purple-500/25 flex items-center justify-center mb-4 group-hover:bg-purple-500/15 group-hover:border-purple-500/40 transition-all duration-300">
                      <FeatureIcon label={feature.label} />
                    </div>
                    <h3 className="text-base font-bold text-text-primary tracking-tight mb-1.5">
                      {feature.label}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed mb-4">
                      {feature.desc}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-purple-400 group-hover:text-purple-300 transition-colors">
                      Explore
                      <svg
                        className="w-3 h-3 group-hover:translate-x-0.5 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <title>Explore</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
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
