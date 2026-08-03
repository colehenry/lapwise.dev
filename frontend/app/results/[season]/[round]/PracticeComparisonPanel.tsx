"use client";

import { useQuery } from "@tanstack/react-query";
import CrossSessionComparison from "@/components/CrossSessionComparison";
import { roundSessionQuery } from "@/lib/queries/sessions";

type PracticeComparisonPanelProps = {
  season: number;
  round: number;
  practiceNumbers: number[];
};

/**
 * Compares the weekend's practice sessions. Mounted only when the comparison
 * panel is reached, so the extra practice sessions are requested there rather
 * than on every weekend page load.
 */
export default function PracticeComparisonPanel({
  season,
  round,
  practiceNumbers,
}: PracticeComparisonPanelProps) {
  const available = new Set(practiceNumbers);

  const fp1 = useQuery({
    ...roundSessionQuery(season, round, "practice", 1),
    enabled: available.has(1),
  });
  const fp2 = useQuery({
    ...roundSessionQuery(season, round, "practice", 2),
    enabled: available.has(2),
  });
  const fp3 = useQuery({
    ...roundSessionQuery(season, round, "practice", 3),
    enabled: available.has(3),
  });

  return (
    <CrossSessionComparison
      fp1Data={fp1.data}
      fp2Data={fp2.data}
      fp3Data={fp3.data}
    />
  );
}
