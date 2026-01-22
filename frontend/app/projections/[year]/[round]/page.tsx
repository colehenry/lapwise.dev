"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";
import { getCircuitFlagEmoji } from "@/lib/flags";

interface UpcomingEvent {
  event_name: string;
  event_type: string;
  event_date: string;
  location: string;
  country: string;
  round_number: number | null;
  circuit_id: number | null;
  circuit_name: string | null;
}

async function fetchUpcomingEvents(): Promise<UpcomingEvent[]> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || "";
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/events/upcoming?limit=10`,
    {
      headers: {
        "X-API-Key": apiKey,
      },
    },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch upcoming events");
  }

  return res.json();
}

function getDaysUntilEvent(dateString: string): number {
  const eventDate = new Date(dateString);
  const today = new Date();
  const diffTime = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default function ProjectionsPage() {
  const params = useParams();
  const year = params.year as string;
  const round = params.round as string;

  const { data: events, isLoading } = useQuery({
    queryKey: ["upcoming-events-all"],
    queryFn: fetchUpcomingEvents,
    staleTime: 60 * 60 * 1000,
  });

  // Find the specific event for this year/round
  const event = events?.find(
    (e) =>
      e.round_number === Number.parseInt(round, 10) &&
      new Date(e.event_date).getFullYear() === Number.parseInt(year, 10),
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-bg-primary">
        <Section spacing="lg" background="primary">
          <div className="text-center">
            <p className="text-text-tertiary">Loading projections...</p>
          </div>
        </Section>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-bg-primary">
        <Section spacing="lg" background="primary">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-text-primary mb-4">
              Event Not Found
            </h1>
            <p className="text-text-tertiary mb-6">
              Could not find event for Round {round} of {year}
            </p>
            <Link href="/">
              <Button variant="primary">Return Home</Button>
            </Link>
          </div>
        </Section>
      </main>
    );
  }

  const daysUntil = getDaysUntilEvent(event.event_date);
  const flag = getCircuitFlagEmoji(event.country);
  const eventDate = new Date(event.event_date);
  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="min-h-screen bg-bg-primary">
      {/* Hero Section */}
      <Section
        spacing="xl"
        background="gradient"
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-[128px]" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-500 rounded-full blur-[128px]" />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Flag and Countdown */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-7xl">{flag}</div>
            <div className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-lg px-8 py-4 border-2 border-white/20">
              <span className="text-5xl font-bold text-white">{daysUntil}</span>
              <span className="text-sm text-white/80 uppercase tracking-wide">
                {daysUntil === 1 ? "Day Away" : "Days Away"}
              </span>
            </div>
          </div>

          <Badge variant="purple" size="lg" className="mb-4">
            Round {round} • {year}
          </Badge>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary mb-4">
            {event.event_name}
          </h1>

          <p className="text-xl md:text-2xl text-text-tertiary mb-2">
            {event.location}, {event.country}
          </p>

          <p className="text-lg text-text-muted">{formattedDate}</p>
        </div>
      </Section>

      {/* Projections Section */}
      <Section spacing="lg" background="primary">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-text-primary text-center mb-8">
            Race Projections
          </h2>

          <Card variant="default" padding="lg">
            <div className="text-center py-12">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-purple-500/10 border-2 border-purple-500/20 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Clock icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-text-primary mb-3">
                Projections Coming Soon
              </h3>

              <p className="text-text-tertiary text-lg mb-6">
                Race projections will be available 4-5 days before race day.
              </p>

              <p className="text-text-muted">
                Check back closer to the event for detailed predictions, weather
                forecasts, and performance analysis.
              </p>
            </div>
          </Card>
        </div>
      </Section>

      {/* Quick Links */}
      <Section spacing="lg" background="secondary">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-text-primary text-center mb-6">
            Explore More
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card variant="interactive" padding="lg">
              <h4 className="text-lg font-bold text-text-primary mb-2">
                View Circuit Details
              </h4>
              <p className="text-text-tertiary mb-4">
                Explore historical data and statistics for this circuit.
              </p>
              <Link href={`/results/${year}/${round}`}>
                <Button variant="ghost" className="w-full">
                  View Circuit
                </Button>
              </Link>
            </Card>

            <Card variant="interactive" padding="lg">
              <h4 className="text-lg font-bold text-text-primary mb-2">
                Driver Standings
              </h4>
              <p className="text-text-tertiary mb-4">
                Check current championship standings and driver statistics.
              </p>
              <Link href="/drivers">
                <Button variant="ghost" className="w-full">
                  View Drivers
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </Section>
    </main>
  );
}
