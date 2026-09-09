import type { AnalysisFamily } from "@/lib/ai/analysis-contracts";

export interface ClutchAcceptanceCase {
  id: string;
  question: string;
  families: AnalysisFamily[];
  expected: {
    entities: string[];
    metrics: string[];
    evidenceKinds: Array<"database" | "knowledge_node" | "calculation">;
    exactFacts?: Record<string, string | number>;
    forbiddenClaims?: string[];
  };
}

export const clutchAcceptanceCases: ClutchAcceptanceCase[] = [
  {
    id: "qualifying-norris-piastri-2025",
    question:
      "Compare Lando Norris and Oscar Piastri in qualifying across the 2025 season.",
    families: ["qualifying_comparison"],
    expected: {
      entities: ["Lando Norris", "Oscar Piastri", "2025"],
      metrics: ["head_to_head", "poles", "mutual_q3", "median_q3_gap"],
      evidenceKinds: ["database", "calculation"],
      exactFacts: {
        norrisHeadToHeadWins: 13,
        piastriHeadToHeadWins: 11,
        norrisPoles: 7,
        piastriPoles: 6,
        mutualQ3Appearances: 22,
        medianPiastriMinusNorrisSeconds: 0.0305,
      },
      forbiddenClaims: ["8–5", "0.075 seconds"],
    },
  },
  {
    id: "result-monaco-2024-podium",
    question: "Who finished on the podium at the 2024 Monaco Grand Prix?",
    families: ["results"],
    expected: {
      entities: ["Monaco Grand Prix", "2024"],
      metrics: ["finishing_position"],
      evidenceKinds: ["database"],
      exactFacts: {
        winner: "Charles Leclerc",
        second: "Oscar Piastri",
        third: "Carlos Sainz",
      },
    },
  },
  {
    id: "standings-final-2023-drivers",
    question: "Show the final top five in the 2023 drivers' championship.",
    families: ["standings"],
    expected: {
      entities: ["2023"],
      metrics: ["championship_position", "points"],
      evidenceKinds: ["database"],
      exactFacts: {
        first: "Max Verstappen — 575",
        second: "Sergio Perez — 285",
        third: "Lewis Hamilton — 234",
        fourth: "Fernando Alonso — 206",
        fifth: "Charles Leclerc — 206",
      },
    },
  },
  {
    id: "race-narrative-silverstone-2024",
    question: "How did Hamilton win the 2024 British Grand Prix?",
    families: ["race_narrative"],
    expected: {
      entities: ["Lewis Hamilton", "British Grand Prix", "2024"],
      metrics: ["position_path", "pit_stops", "race_control"],
      evidenceKinds: ["database", "calculation"],
    },
  },
  {
    id: "strategy-australia-2025",
    question: "Explain the winning strategy at the 2025 Australian Grand Prix.",
    families: ["strategy"],
    expected: {
      entities: ["Australian Grand Prix", "2025"],
      metrics: ["stints", "pit_stops", "neutralizations"],
      evidenceKinds: ["database", "calculation"],
    },
  },
  {
    id: "rules-fastest-lap-point-2024",
    question: "Could a driver still earn a fastest-lap point in 2024?",
    families: ["rules"],
    expected: {
      entities: ["2024"],
      metrics: ["rule_effective_dates"],
      evidenceKinds: ["knowledge_node"],
    },
  },
  {
    id: "weather-canada-2024",
    question: "Was the 2024 Canadian Grand Prix affected by rain?",
    families: ["weather", "race_narrative"],
    expected: {
      entities: ["Canadian Grand Prix", "2024"],
      metrics: ["rainfall", "track_conditions"],
      evidenceKinds: ["database"],
    },
  },
  {
    id: "comparison-verstappen-norris-2024",
    question: "Compare Verstappen and Norris across the 2024 season.",
    families: ["results", "standings", "qualifying_comparison"],
    expected: {
      entities: ["Max Verstappen", "Lando Norris", "2024"],
      metrics: ["wins", "podiums", "points", "head_to_head"],
      evidenceKinds: ["database", "calculation"],
    },
  },
  {
    id: "multi-facet-ferrari-2024",
    question:
      "How did Ferrari's qualifying position relate to its race results in 2024?",
    families: ["qualifying_comparison", "results"],
    expected: {
      entities: ["Ferrari", "2024"],
      metrics: ["qualifying_position", "finishing_position"],
      evidenceKinds: ["database", "calculation"],
    },
  },
  {
    id: "ambiguous-sprint-austin",
    question: "Who won the sprint in Austin?",
    families: ["results"],
    expected: {
      entities: ["Austin"],
      metrics: ["winner"],
      evidenceKinds: ["database"],
      forbiddenClaims: ["invented season"],
    },
  },
  {
    id: "follow-up-pronoun",
    question: "How did he do in qualifying that weekend?",
    families: ["qualifying_comparison"],
    expected: {
      entities: [],
      metrics: ["qualifying_position"],
      evidenceKinds: ["database"],
      forbiddenClaims: ["unresolved pronoun treated as a driver"],
    },
  },
  {
    id: "no-data-old-laps",
    question: "Chart every lap time from the 1960 Monaco Grand Prix.",
    families: ["race_narrative"],
    expected: {
      entities: ["Monaco Grand Prix", "1960"],
      metrics: ["lap_times"],
      evidenceKinds: ["database"],
      forbiddenClaims: ["fabricated lap times"],
    },
  },
  {
    id: "entity-alias-checo-2023",
    question: "How many races did Checo win in 2023?",
    families: ["results"],
    expected: {
      entities: ["Sergio Perez", "2023"],
      metrics: ["wins"],
      evidenceKinds: ["database"],
    },
  },
  {
    id: "session-disambiguation-brazil-2024",
    question: "Compare the sprint and Grand Prix results in Brazil in 2024.",
    families: ["results"],
    expected: {
      entities: ["São Paulo Grand Prix", "2024"],
      metrics: ["sprint_result", "race_result"],
      evidenceKinds: ["database"],
    },
  },
  {
    id: "general-capability-boundary",
    question: "Can you predict who will win the next championship?",
    families: ["general"],
    expected: {
      entities: [],
      metrics: [],
      evidenceKinds: [],
      forbiddenClaims: ["prediction presented as a verified fact"],
    },
  },
];
