"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import ArchiveListPage, {
  CURRENT_YEAR,
  type SeasonRange,
} from "@/components/archive/ArchiveListPage";
import TrackMapImage from "@/components/track/TrackMapImage";
import TiltCard from "@/components/ui/TiltCard";
import { getCircuitFlagEmoji } from "@/lib/flags";
import { circuitsQuery } from "@/lib/queries/archive";
import { seasonsQuery } from "@/lib/queries/seasons";
import type { CircuitInfo } from "@/lib/types";

type SortKey = "races" | "recent" | "alpha";

function CircuitCard({ circuit }: { circuit: CircuitInfo }) {
  return (
    <TiltCard>
      <Link href={`/circuits/${circuit.venue_slug}`} className="block h-full">
        <div className="relative border border-border-primary rounded-sm p-4 hover:border-purple-500 transition-all duration-200 bg-bg-tertiary h-full">
          <div className="flex items-center gap-4">
            {/* Track map */}
            <div className="flex-shrink-0 w-20 h-20 rounded-sm bg-bg-secondary flex items-center justify-center border border-border-primary p-2">
              <TrackMapImage
                circuitId={circuit.id}
                circuitName={circuit.name}
                width={80}
                height={80}
                className="object-contain w-full h-full"
                fallbackClassName="h-full w-full px-2"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-text-primary font-bold truncate">
                {circuit.name}
              </h3>
              <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                <span>{circuit.location}</span>
                <span className="text-border-secondary">/</span>
                <span className="flex items-center gap-1">
                  <span>{getCircuitFlagEmoji(circuit.country)}</span>
                  <span>{circuit.country}</span>
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-muted font-mono tracking-wider mt-2">
                {circuit.track_length_km && (
                  <>
                    <span className="text-purple-400">
                      {circuit.track_length_km.toFixed(3)} km
                    </span>
                    <span className="text-border-secondary">/</span>
                  </>
                )}
                <span>
                  {circuit.most_recent_year === CURRENT_YEAR
                    ? `${circuit.first_year}–`
                    : circuit.first_year === circuit.most_recent_year
                      ? circuit.first_year
                      : `${circuit.first_year}–${circuit.most_recent_year}`}
                </span>
              </div>
            </div>

            {/* Race count */}
            <div className="flex-shrink-0 text-right">
              <div className="text-2xl font-bold text-text-primary tabular-nums">
                {circuit.total_races}
              </div>
              <div className="text-[10px] text-text-muted font-mono tracking-widest uppercase">
                races
              </div>
            </div>
          </div>
        </div>
      </Link>
    </TiltCard>
  );
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "races", label: "Races" },
  { key: "recent", label: "Recent" },
  { key: "alpha", label: "A-Z" },
];

const COMPARATORS: Record<SortKey, (a: CircuitInfo, b: CircuitInfo) => number> =
  {
    races: (a, b) => b.total_races - a.total_races,
    recent: (a, b) => b.most_recent_year - a.most_recent_year,
    alpha: (a, b) => a.name.localeCompare(b.name),
  };

function seasonRange(circuit: CircuitInfo): SeasonRange {
  return { first: circuit.first_year, last: circuit.most_recent_year };
}

function matchesSearch(circuit: CircuitInfo, query: string): boolean {
  return (
    circuit.name.toLowerCase().includes(query) ||
    circuit.location.toLowerCase().includes(query) ||
    circuit.country.toLowerCase().includes(query)
  );
}

export default function CircuitsArchive() {
  const { data, isLoading } = useQuery(circuitsQuery());
  const { data: availableYears = [] } = useQuery(seasonsQuery());

  return (
    <ArchiveListPage
      title="Circuits"
      allTimeSubtitle="All-Time Track Statistics"
      seasonSubtitle={(year) => `${year} Season Calendar`}
      searchPlaceholder="Search by circuit, location, or country..."
      noun="circuits"
      items={data?.circuits}
      isLoading={isLoading}
      availableYears={availableYears}
      sortOptions={SORT_OPTIONS}
      defaultSort="races"
      comparators={COMPARATORS}
      matchesSearch={matchesSearch}
      seasonRange={seasonRange}
      itemKey={(circuit) => String(circuit.id)}
      renderCard={(circuit) => <CircuitCard circuit={circuit} />}
      gridClassName="grid grid-cols-1 md:grid-cols-2 gap-3"
      skeletonHeight="100px"
    />
  );
}
