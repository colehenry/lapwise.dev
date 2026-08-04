"use client";

import { Fragment, type ReactNode, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import ExpandButton from "@/components/ui/ExpandButton";
import Skeleton from "@/components/ui/Skeleton";
import SortPills from "@/components/ui/SortPills";
import SprintToggle from "@/components/ui/SprintToggle";

/**
 * The shell every all-time archive route shares: season filter, search, sort,
 * a card grid capped until expanded, and the loading and empty states.
 *
 * Routes supply what actually differs — the card, the sort comparators, the
 * search predicate, and where a season range lives on their row type. Drivers,
 * constructors, and circuits each had their own copy of the rest.
 */

/** Cards mark the current season as active; the season filter treats it as open-ended. */
export const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_VISIBLE_COUNT = 30;
const SKELETON_COUNT = 12;

/** First and last season an entry was present, for the season filter. */
export type SeasonRange = {
  first: number | null;
  last: number | null;
};

export type ArchiveListPageProps<T, S extends string> = {
  title: string;
  /** Shown under the title when no single season is selected. */
  allTimeSubtitle: string;
  /** Shown when a season is selected, e.g. `${year} Season Entries`. */
  seasonSubtitle: (year: string) => string;
  searchPlaceholder: string;
  /** Plural noun for the count and empty state: "drivers", "circuits". */
  noun: string;

  items: T[] | undefined;
  isLoading: boolean;
  /** Dims the grid during a background refetch; omit where none occurs. */
  isFetching?: boolean;
  availableYears: number[];

  sortOptions: { key: S; label: string }[];
  defaultSort: S;
  comparators: Record<S, (a: T, b: T) => number>;
  matchesSearch: (item: T, query: string) => boolean;
  seasonRange: (item: T) => SeasonRange;

  itemKey: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  gridClassName: string;
  skeletonHeight: string;

  /** Present only on routes whose totals can include sprint points. */
  sprintToggle?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
};

export default function ArchiveListPage<T, S extends string>({
  title,
  allTimeSubtitle,
  seasonSubtitle,
  searchPlaceholder,
  noun,
  items,
  isLoading,
  isFetching = false,
  availableYears,
  sortOptions,
  defaultSort,
  comparators,
  matchesSearch,
  seasonRange,
  itemKey,
  renderCard,
  gridClassName,
  skeletonHeight,
  sprintToggle,
}: ArchiveListPageProps<T, S>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<S>(defaultSort);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedYear, setSelectedYear] = useState("all");

  const filtered = useMemo(() => {
    if (!items) return [];

    let rows = items;

    if (selectedYear !== "all") {
      const year = Number.parseInt(selectedYear, 10);
      rows = rows.filter((item) => {
        const { first, last } = seasonRange(item);
        if (first === null || last === null) return false;
        return (
          first <= year &&
          (last >= year || (last === CURRENT_YEAR && year === CURRENT_YEAR))
        );
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      rows = rows.filter((item) => matchesSearch(item, query));
    }

    return [...rows].sort(comparators[sortKey]);
  }, [
    items,
    searchQuery,
    sortKey,
    selectedYear,
    comparators,
    matchesSearch,
    seasonRange,
  ]);

  const visible = isExpanded
    ? filtered
    : filtered.slice(0, DEFAULT_VISIBLE_COUNT);

  return (
    <div className="min-h-screen bg-bg-secondary">
      <PageHeader
        title={title}
        subtitle={
          selectedYear === "all"
            ? allTimeSubtitle
            : seasonSubtitle(selectedYear)
        }
        compactMobile
      >
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="w-28 bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-3 py-2 md:py-1.5 rounded-sm focus:outline-none focus:border-purple-500 transition-colors duration-150 cursor-pointer uppercase tracking-widest"
        >
          <option value="all">ALL TIME</option>
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </PageHeader>

      <div className="max-w-6xl mx-auto px-3 py-3 md:px-8 md:py-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-bg-primary text-text-primary border border-border-primary rounded-sm font-mono text-xs focus:outline-none focus:border-purple-500 transition-colors placeholder-text-muted"
          />
          <SortPills
            active={sortKey}
            onChange={setSortKey}
            options={sortOptions}
          />
        </div>

        {items &&
          (sprintToggle ? (
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] text-text-muted font-mono tracking-widest uppercase">
                {filtered.length} total {noun}
              </span>
              <SprintToggle
                checked={sprintToggle.checked}
                onChange={sprintToggle.onChange}
                isLoading={isFetching}
              />
            </div>
          ) : (
            <div className="text-[10px] text-text-muted font-mono tracking-widest uppercase mb-6">
              {filtered.length} total {noun}
            </div>
          ))}

        {isLoading && (
          <div className={gridClassName}>
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <Skeleton
                key={`skel-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: Static loading skeleton
                  i
                }`}
                variant="rectangular"
                height={skeletonHeight}
                className="rounded-sm"
              />
            ))}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div
            className={`transition-opacity duration-150 ${isFetching ? "opacity-50" : ""}`}
          >
            <div className={gridClassName}>
              {visible.map((item) => (
                <Fragment key={itemKey(item)}>{renderCard(item)}</Fragment>
              ))}
            </div>
          </div>
        )}

        {!isLoading && filtered.length > DEFAULT_VISIBLE_COUNT && (
          <ExpandButton
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
            remainingCount={filtered.length - DEFAULT_VISIBLE_COUNT}
          />
        )}

        {!isLoading && filtered.length === 0 && items && (
          <div className="border border-border-primary rounded-sm p-8 text-center">
            <p className="text-text-muted font-mono text-sm">
              No {noun} found matching "{searchQuery}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
