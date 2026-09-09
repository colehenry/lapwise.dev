import { z } from "zod";

export const analysisFamilySchema = z.enum([
  "results",
  "standings",
  "qualifying_comparison",
  "race_narrative",
  "strategy",
  "rules",
  "weather",
  "general",
]);

export const presentationSchema = z.enum([
  "narrative",
  "metric_cards",
  "table",
  "chart",
  "timeline",
]);

export const analysisPageContextSchema = z.object({
  route: z.string().startsWith("/").max(300),
  season: z.number().int().min(1950).max(2100).optional(),
  round: z.number().int().positive().max(40).optional(),
  sessionId: z.number().int().positive().optional(),
  sessionType: z
    .enum(["race", "sprint_race", "qualifying", "sprint_qualifying"])
    .optional(),
  driverSlugs: z.array(z.string().min(1).max(100)).max(4).optional(),
  constructorSlugs: z.array(z.string().min(1).max(100)).max(4).optional(),
  activeFilters: z
    .record(
      z.string().min(1).max(60),
      z.union([z.string().max(200), z.number(), z.boolean()]),
    )
    .refine((filters) => Object.keys(filters).length <= 8)
    .optional(),
});

export const analysisRequestSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  pageContext: analysisPageContextSchema.optional(),
});

export const resolvedEntitySchema = z.object({
  kind: z.enum(["driver", "team", "event", "season"]),
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
});

export const analysisFacetSchema = z.object({
  family: analysisFamilySchema,
  objective: z.string().min(1),
  metrics: z.array(z.string().min(1)),
  presentations: z.array(presentationSchema).min(1),
});

export const analysisPlanSchema = z.object({
  version: z.literal(1),
  question: z.string().min(1).max(2000),
  entities: z.array(resolvedEntitySchema),
  scope: z.object({
    season: z.number().int().min(1950).max(2100).optional(),
    rounds: z.array(z.number().int().positive()).optional(),
    sessionTypes: z.array(z.string().min(1)).optional(),
  }),
  facets: z.array(analysisFacetSchema).min(1),
  assumptions: z.array(z.string()),
  unresolvedTerms: z.array(z.string()),
});

export const evidenceRecordSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["database", "knowledge_node", "calculation"]),
  label: z.string().min(1),
  source: z.string().min(1),
  fields: z.record(z.string(), z.unknown()),
});

export const verifiedMetricSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  displayValue: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
});

export const artifactTableSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  columns: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
    }),
  ),
  rows: z.array(z.record(z.string(), z.unknown())),
});

export const artifactChartSchema = z.object({
  id: z.string().min(1),
  chartType: z.enum(["line", "bar", "scatter", "pie", "stacked_bar"]),
  title: z.string().min(1),
  xLabel: z.string(),
  yLabel: z.string(),
  data: z.array(z.record(z.string(), z.unknown())),
  xKey: z.string().min(1),
  yKeys: z.array(z.string().min(1)).min(1),
  seriesLabels: z.array(z.string().min(1)).optional(),
  colors: z.array(z.string()),
});

export const answerArtifactSchema = z.object({
  version: z.literal(1),
  family: analysisFamilySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  metrics: z.array(verifiedMetricSchema),
  tables: z.array(artifactTableSchema),
  charts: z.array(artifactChartSchema),
  evidence: z.array(evidenceRecordSchema).min(1),
  caveats: z.array(z.string()),
  actions: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        href: z.string().startsWith("/").max(300),
      }),
    )
    .max(5)
    .optional(),
});

export type AnalysisFamily = z.infer<typeof analysisFamilySchema>;
export type AnalysisPageContext = z.infer<typeof analysisPageContextSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type AnalysisPlan = z.infer<typeof analysisPlanSchema>;
export type AnswerArtifact = z.infer<typeof answerArtifactSchema>;
