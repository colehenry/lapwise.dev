import Link from "next/link";
import RecentRaceCard from "@/components/RecentRaceCard";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";

export default function Home() {
  return (
    <div className="bg-bg-primary">
      {/* Hero Section */}
      <Section
        spacing="xl"
        background="gradient"
        className="relative overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-[128px]" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-500 rounded-full blur-[128px]" />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <Badge variant="purple" size="lg" className="mb-6">
            Professional F1 Analytics
          </Badge>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary mb-6 animate-fadeIn">
            <span className="text-purple-400">Lap</span>
            <span className="text-text-primary">wise</span>
          </h1>
          <p className="text-xl md:text-2xl text-text-tertiary mb-8 animate-slideUp">
            Dive deep into Formula 1 data, telemetry, and race results.
            <br />
            Professional analytics for passionate F1 fans.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slideUp">
            <Button variant="primary" size="lg" className="group">
              <Link href="/results" className="flex items-center">
                Explore Results
                <svg
                  className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
            </Button>
            <Button variant="secondary" size="lg">
              <Link href="/about">Learn More</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-16 max-w-2xl mx-auto">
            <div>
              <p className="text-3xl font-bold text-purple-400">74+</p>
              <p className="text-text-tertiary text-sm mt-1">Seasons</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-purple-400">1000+</p>
              <p className="text-text-tertiary text-sm mt-1">Races</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-purple-400">Real-time</p>
              <p className="text-text-tertiary text-sm mt-1">Telemetry</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Latest Race Results */}
      <Section spacing="lg" background="primary">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-text-primary mb-2">
              Latest Race Results
            </h2>
            <p className="text-text-tertiary">
              Check out the most recent Grand Prix results
            </p>
          </div>
          <Link href="/results">
            <Button variant="ghost">
              View All
              <svg
                className="w-4 h-4 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Arrow right</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>
          </Link>
        </div>
        <RecentRaceCard />
      </Section>

      {/* Features Section */}
      <Section spacing="lg" background="secondary">
        <h2 className="text-3xl font-bold text-text-primary text-center mb-12">
          Everything You Need
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card variant="interactive" padding="lg">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Championship icon</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Championship Standings
            </h3>
            <p className="text-text-tertiary">
              Track driver and constructor standings throughout the season with
              detailed points breakdowns.
            </p>
          </Card>

          <Card variant="interactive" padding="lg">
            <div className="w-12 h-12 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Telemetry icon</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Telemetry Data
            </h3>
            <p className="text-text-tertiary">
              Explore lap times, sector performance, and detailed telemetry
              analysis for every session.
            </p>
          </Card>

          <Card variant="interactive" padding="lg">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Driver profiles icon</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">
              Driver Profiles
            </h3>
            <p className="text-text-tertiary">
              Comprehensive statistics and career histories for every F1 driver
              past and present.
            </p>
          </Card>
        </div>
      </Section>

      {/* News & Updates Section */}
      <Section spacing="lg" background="primary">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-text-primary mb-2">
              News & Updates
            </h2>
            <p className="text-text-tertiary">
              Stay up to date with the latest from Lapwise
            </p>
          </div>
          <Link href="/blog">
            <Button variant="ghost">
              View All
              <svg
                className="w-4 h-4 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Arrow right</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: "2024 Season Data Now Available",
              date: "January 15, 2026",
              category: "Update",
              excerpt:
                "Complete telemetry and race results for the 2024 F1 season are now available.",
            },
            {
              title: "New Driver Profile Features",
              date: "January 10, 2026",
              category: "Feature",
              excerpt:
                "Enhanced driver statistics with historical performance graphs and career highlights.",
            },
            {
              title: "Improved Lap Time Analysis",
              date: "January 5, 2026",
              category: "Enhancement",
              excerpt:
                "New visualization tools for comparing lap times and tire strategies.",
            },
          ].map((article) => (
            <Card key={article.title} variant="interactive" padding="none">
              <div className="h-48 bg-gradient-to-br from-purple-500/20 to-red-500/20 flex items-center justify-center">
                <svg
                  className="w-16 h-16 text-purple-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Article icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="purple" size="sm">
                    {article.category}
                  </Badge>
                  <span className="text-text-muted text-xs">
                    {article.date}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">
                  {article.title}
                </h3>
                <p className="text-text-tertiary text-sm mb-4">
                  {article.excerpt}
                </p>
                <Link
                  href="/blog"
                  className="text-purple-400 hover:text-purple-300 text-sm font-medium inline-flex items-center transition-colors duration-200"
                >
                  Read more
                  <svg
                    className="w-4 h-4 ml-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Arrow right</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* CTA Section */}
      <Section
        spacing="xl"
        background="gradient"
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500 rounded-full blur-[128px]" />
        </div>

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-text-primary mb-4">
            Ready to dive deeper?
          </h2>
          <p className="text-xl text-text-tertiary mb-8">
            Explore comprehensive F1 analytics and telemetry data from over 70
            years of racing history.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" size="lg">
              <Link href="/results">Explore Results</Link>
            </Button>
            <Button variant="secondary" size="lg">
              <Link href="/contact">Get in Touch</Link>
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
