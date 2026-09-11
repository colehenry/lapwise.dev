import type { ALLOWED_AI_TABLES } from "./allowed-tables";

export type KnowledgeTopic =
  | "results"
  | "race_narrative"
  | "strategy"
  | "qualifying"
  | "standings"
  | "weather"
  | "comparison"
  | "rules"
  | "general";

type AllowedRelation = (typeof ALLOWED_AI_TABLES)[number];
type AnalysisTool =
  | "resolve_session"
  | "get_race_dynamics"
  | "run_sql_query"
  | "generate_chart";

export interface KnowledgeNode {
  id: string;
  topics: KnowledgeTopic[];
  tags: string[];
  keywords?: string[];
  related: string[];
  relations: AllowedRelation[];
  tools: AnalysisTool[];
  markdown: string;
  always?: boolean;
}

export const KNOWLEDGE_NODES: KnowledgeNode[] = [
  {
    id: "core-data-model",
    topics: ["general"],
    tags: ["schema", "coverage", "session-resolution"],
    related: [],
    relations: ["sessions", "circuits", "drivers", "teams", "session_results"],
    tools: ["resolve_session", "run_sql_query"],
    always: true,
    markdown: `## Core data model

- sessions identifies event sessions by id, year, round, session_type, event_name, date, and circuit_id.
- session_results is canonical for classification, grid, points, laps completed, fastest lap, and Q1/Q2/Q3 times.
- drivers supplies full_name and slug. teams are constructor-season rows joined through session_results.team_id.
- Resolve an event-specific session early. Distinguish no matching rows, missing coverage, and an event that has not occurred.`,
  },
  {
    id: "race-shape-evidence",
    topics: ["race_narrative", "strategy"],
    tags: ["leaders", "position-path", "neutralization", "pit-markers"],
    related: ["weather-coverage"],
    relations: [
      "laps",
      "session_results",
      "track_status",
      "race_control_messages",
    ],
    tools: ["get_race_dynamics"],
    markdown: `## Race-shape evidence

- Use lap positions, leader segments, laps led, stints, stop-lap markers, and race control before interpreting a race.
- "Led from pole to flag" requires grid P1, lap-one P1, every leader segment, and finish P1.
- Dominance or control requires lap-position, pace, or gap evidence; final margin alone is insufficient.
- SC/VSC benefit requires a stop or position change overlapping verified neutralized laps.
- Stop laps come from lap pit-in/pit-out markers. They are not stationary pit-stop durations.`,
  },
  {
    id: "qualifying-classification",
    topics: ["qualifying", "comparison"],
    tags: ["q1", "q2", "q3", "pole", "head-to-head"],
    related: [],
    relations: ["sessions", "session_results", "drivers"],
    tools: ["run_sql_query"],
    markdown: `## Qualifying

- Use qualifying or sprint_qualifying sessions. Final qualifying position is session_results.position.
- Q1/Q2/Q3 fields hold best segment times; null normally means elimination or no recorded time.
- Pole claims use qualifying classification, not the race grid when penalties may differ.
- Compute head-to-head and aggregate gaps deterministically over shared sessions.`,
  },
  {
    id: "championship-classification",
    topics: ["standings"],
    tags: ["points", "champion", "classification"],
    related: [],
    relations: ["v_driver_standings", "v_constructor_standings"],
    tools: ["run_sql_query"],
    markdown: `## Championship classification

- Use canonical standings views, not summed session points, for title and standings questions.
- championship_position and championship_points are official; points_scored is the on-track sum.
- Do not rank excluded entrants or infer a historical champion when standings_source is missing_official.
- Label computed_provisional standings explicitly for an active season.`,
  },
  {
    id: "weather-coverage",
    topics: ["weather"],
    tags: ["rain", "temperature", "samples", "coverage"],
    related: [],
    relations: ["weather_data"],
    tools: ["run_sql_query"],
    markdown: `## Weather coverage

- Weather rows are session samples of air/track temperature, humidity, wind, and rainfall.
- Report rainfall sample counts or percentages rather than generalizing from one row.
- Recorded rain proves conditions, not competitive impact; causal claims also need lap and strategy evidence.
- State when weather coverage is sparse or absent.`,
  },
  {
    id: "normalized-comparisons",
    topics: ["comparison"],
    tags: ["drivers", "constructors", "teammates", "pace"],
    related: ["qualifying-classification", "championship-classification"],
    relations: ["sessions", "session_results", "laps", "drivers", "teams"],
    tools: ["run_sql_query"],
    markdown: `## Comparisons

- Normalize driver and constructor comparisons by season and session type.
- Teammate comparisons must use the same session and team entry.
- Pace comparisons use accurate, non-deleted green-flag laps unless mixed conditions are requested.
- Return exact values in a table; add a chart only when it improves interpretation.`,
  },
  {
    id: "fastest-lap-bonus",
    topics: ["rules"],
    tags: ["rules", "points", "fastest-lap"],
    keywords: ["fastest lap", "fastest-lap"],
    related: [],
    relations: ["session_results"],
    tools: [],
    markdown: `## Fastest-lap bonus

From 2019 through 2024, a race fastest lap earned one championship point only when the driver finished in the top ten. The bonus was removed from the 2025 season onward. Separate the rule in force for the requested season from what the database records for one event.`,
  },
  {
    id: "championship-points-system",
    topics: ["rules"],
    tags: ["rules", "points", "scoring", "history"],
    keywords: [
      "scoring",
      "points system",
      "points work",
      "score points",
      "scored points",
    ],
    related: ["fastest-lap-bonus"],
    relations: [],
    tools: [],
    markdown: `## Championship points system

- A full-distance Grand Prix awards the top ten 25, 18, 15, 12, 10, 8, 6, 4, 2, and 1 point. A Sprint awards the top eight 8 points down to 1.
- A driver keeps the points they score; the Constructors' Championship adds the points scored by both of a team's cars. The highest season total wins, with countback used to break a tie.
- Major historical shifts: only the top five scored in 1950; the field expanded to six scorers in 1960, eight in 2003, and ten under the current scale in 2010. Only a selection of a driver's best results counted until 1991.
- The fastest-lap bonus applied from 2019 through 2024 and was removed for 2025.
- Scoring is part of the sporting rules. It can change independently of major car, engine, or aerodynamic regulation changes; the calendars may coincide, but one does not automatically cause the other.
- Source: Formula 1 points-system overview: https://www.formula1.com/en/latest/article/how-many-world-championship-titles-would-f1-drivers-have-won-using-the.182RC42vohx8STIpJR5o26`,
  },
  {
    id: "parc-ferme",
    topics: ["rules", "general"],
    tags: ["rules", "car-setup", "scrutineering"],
    keywords: ["parc ferme", "parc fermé"],
    related: [],
    relations: [],
    tools: [],
    markdown: `## Parc fermé

- Parc fermé is the regulated condition in which teams may not replace or modify car parts or change setup/configuration except for specifically permitted work or work approved by the FIA Technical Delegate.
- Under the 2026 sporting rules, a car enters pre-Sprint parc fermé when it first leaves the pit lane in Sprint Qualifying, and pre-race parc fermé when it first leaves the pit lane in Qualifying. Those periods run until the Sprint or Race respectively.
- A car that does not leave the pit lane is deemed in parc fermé at the end of SQ1 or Q1.
- A setup-changing breach normally requires the relevant driver to start the Sprint or Race from the pit lane, depending on when the breach occurs and the event format.
- Do not claim that all work is prohibited: Appendix B2 lists permitted work, and the Technical Delegate may approve specified replacements or safety work.
- Source: FIA 2026 Formula 1 Sporting Regulations, Articles B3.5.1-B3.5.4 and Appendix B2: https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_06_-_2026-04-28.pdf`,
  },
  {
    id: "chart-presentation",
    topics: ["general"],
    tags: ["chart", "presentation"],
    keywords: ["chart", "graph", "plot", "visualize", "visualise", "trend"],
    related: [],
    relations: [],
    tools: ["generate_chart"],
    markdown: `## Chart presentation

Use line charts for trends and tables for rankings or exact comparisons. Chart values must come from retrieved or deterministic metrics, with human-readable series labels.`,
  },
];

export function inferKnowledgeTopics(question: string): KnowledgeTopic[] {
  const q = question.toLowerCase();
  const topics: KnowledgeTopic[] = [];
  if (
    /\b(rule|allowed|eligible|scoring|points? system|points? work|score points|could .* earn|fastest[- ]lap\b.*\b(?:points?|bonus))\b/.test(
      q,
    )
  )
    topics.push("rules");
  if (
    /\b(led|lead|dominant|controlled|safety car|vsc|recovered|lucky|turning points?|what decided|why did|how did)\b/.test(
      q,
    )
  )
    topics.push("race_narrative");
  if (/\b(pit|strategy|undercut|overcut|stint|tyre|tire)\b/.test(q))
    topics.push("strategy");
  if (/\b(quali|qualifying|q1|q2|q3|pole)\b/.test(q)) topics.push("qualifying");
  if (/\b(standings|championship|title|constructor)\b/.test(q))
    topics.push("standings");
  if (/\b(weather|rain|wet|dry|temperature|humidity|wind)\b/.test(q))
    topics.push("weather");
  if (
    /\b(compare|comparison|versus| vs |head[- ]to[- ]head|teammate)\b/.test(q)
  )
    topics.push("comparison");
  if (/\b(who won|winner|podium|result|finished|classification)\b/.test(q))
    topics.push("results");
  return topics.length > 0 ? [...new Set(topics)] : ["general"];
}

export function selectKnowledgeNodes(
  topics: KnowledgeTopic[],
  question: string,
): KnowledgeNode[] {
  const q = question.toLowerCase();
  const selected = new Set(
    KNOWLEDGE_NODES.filter(
      (node) =>
        node.always ||
        (node.topics.some((topic) => topics.includes(topic)) &&
          (!node.keywords ||
            node.keywords.some((keyword) => q.includes(keyword)))),
    ).map((node) => node.id),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of KNOWLEDGE_NODES) {
      if (!selected.has(node.id)) continue;
      for (const relatedId of node.related) {
        if (selected.has(relatedId)) continue;
        selected.add(relatedId);
        changed = true;
      }
    }
  }
  return KNOWLEDGE_NODES.filter((node) => selected.has(node.id));
}
