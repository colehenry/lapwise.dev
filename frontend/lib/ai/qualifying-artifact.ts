import {
  type AnswerArtifact,
  answerArtifactSchema,
} from "./analysis-contracts";
import type { QualifyingComparison } from "./qualifying-comparison";

function rounded(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return (
    (Math.sign(value) *
      Math.round((Math.abs(value) + Number.EPSILON) * factor)) /
    factor
  );
}

function signedSeconds(value: number | null): string {
  if (value === null) return "No mutual Q3 time";
  const sign = value > 0 ? "+" : "";
  return `${sign}${rounded(value, 3).toFixed(3)} s`;
}

export function buildQualifyingArtifact(
  comparison: QualifyingComparison,
): AnswerArtifact {
  const [first, second] = comparison.drivers;
  const gap = comparison.medianSecondMinusFirstQ3Seconds;
  const gapDescription =
    gap === null
      ? "No sessions contained Q3 times for both drivers."
      : `${second.name} minus ${first.name} was ${signedSeconds(gap)} at the median.`;
  const excluded = comparison.comparedRounds - comparison.mutualQ3Rounds;

  return answerArtifactSchema.parse({
    version: 1,
    family: "qualifying_comparison",
    title: `${comparison.season} qualifying: ${first.name} vs ${second.name}`,
    summary: `${first.name} led the qualifying head-to-head ${first.headToHeadWins}–${second.headToHeadWins} across ${comparison.comparedRounds} rounds. Pole positions were ${first.poles}–${second.poles}. ${gapDescription}`,
    metrics: [
      {
        id: "head-to-head",
        label: "Qualifying head-to-head",
        value: `${first.headToHeadWins}-${second.headToHeadWins}`,
        displayValue: `${first.headToHeadWins}–${second.headToHeadWins}`,
        evidenceIds: ["qualifying-results", "head-to-head-calculation"],
      },
      {
        id: "poles",
        label: "Pole positions",
        value: `${first.poles}-${second.poles}`,
        displayValue: `${first.poles}–${second.poles}`,
        evidenceIds: ["qualifying-results", "head-to-head-calculation"],
      },
      {
        id: "mutual-q3",
        label: "Mutual Q3 appearances",
        value: comparison.mutualQ3Rounds,
        displayValue: String(comparison.mutualQ3Rounds),
        evidenceIds: ["qualifying-results", "q3-gap-calculation"],
      },
      ...(gap === null
        ? []
        : [
            {
              id: "median-q3-gap",
              label: `${second.name} minus ${first.name}, median Q3 gap`,
              value: rounded(gap, 4),
              displayValue: signedSeconds(gap),
              evidenceIds: ["qualifying-results", "q3-gap-calculation"],
            },
          ]),
    ],
    tables: [
      {
        id: "round-by-round",
        title: "Round-by-round comparison",
        columns: [
          { key: "round", label: "Round" },
          { key: "event", label: "Event" },
          { key: "firstPosition", label: `${first.name} grid` },
          { key: "secondPosition", label: `${second.name} grid` },
          { key: "q3Gap", label: `${second.name} − ${first.name}` },
        ],
        rows: comparison.rounds.map((round) => ({
          round: round.round,
          event: round.event,
          firstPosition: round.firstPosition ?? "—",
          secondPosition: round.secondPosition ?? "—",
          q3Gap: signedSeconds(round.secondMinusFirstQ3Seconds),
        })),
      },
    ],
    charts: [
      {
        id: "q3-gap-by-round",
        chartType: "bar",
        title: `Q3 gap by round (${second.name} minus ${first.name})`,
        xLabel: "Round",
        yLabel: "Seconds",
        xKey: "round",
        yKeys: ["q3GapSeconds"],
        seriesLabels: [`${second.name} − ${first.name}`],
        colors: [],
        data: comparison.rounds
          .filter((round) => round.secondMinusFirstQ3Seconds !== null)
          .map((round) => ({
            round: round.round,
            event: round.event,
            q3GapSeconds: rounded(round.secondMinusFirstQ3Seconds as number, 3),
          })),
      },
    ],
    evidence: [
      {
        id: "qualifying-results",
        kind: "database",
        label: "Canonical qualifying classifications and segment times",
        source: "sessions + session_results + drivers",
        fields: {
          season: comparison.season,
          drivers: [first.slug, second.slug],
          rounds: comparison.qualifyingRounds,
        },
      },
      {
        id: "head-to-head-calculation",
        kind: "calculation",
        label: "Lower classified position in each shared qualifying session",
        source: "deterministic/qualifying-comparison-v1",
        fields: { comparedRounds: comparison.comparedRounds },
      },
      {
        id: "q3-gap-calculation",
        kind: "calculation",
        label: `${second.name} Q3 time minus ${first.name} Q3 time`,
        source: "deterministic/qualifying-comparison-v1",
        fields: {
          mutualQ3Rounds: comparison.mutualQ3Rounds,
          firstFaster: first.fasterQ3Appearances,
          secondFaster: second.fasterQ3Appearances,
        },
      },
    ],
    caveats:
      excluded > 0
        ? [
            `The median Q3 gap excludes ${excluded} round${excluded === 1 ? "" : "s"} where either driver had no Q3 time. Head-to-head uses final qualifying classification for all shared rounds.`,
          ]
        : [],
    actions: [
      { label: `Open ${first.name}`, href: `/drivers/${first.slug}` },
      { label: `Open ${second.name}`, href: `/drivers/${second.slug}` },
      {
        label: `Open ${comparison.season} qualifying results`,
        href: `/results/${comparison.season}?tab=qualifying`,
      },
    ],
  });
}
