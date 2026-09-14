/**
 * Clutch request ledger.
 *
 * One row in `ai_request_logs` per /api/ai/ask request, for every outcome.
 * `ai_messages` only records successful turns; this is what answers
 * "what happened to that request". Writing the row can never fail the
 * request: failures go to Sentry and the response proceeds.
 */

import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { getConversationClient } from "./db";
import { createResponseCacheHash } from "./response-cache-key";

export type RequestLogPath = "deterministic" | "agent";
export type RequestLogStatus = "ok" | "error" | "aborted" | "rejected";
export type RequestLogStage =
  | "ip_limit"
  | "auth"
  | "body"
  | "user_limit"
  | "ownership"
  | "planning"
  | "model"
  | "stream"
  | "persist"
  | "unknown";

export interface RequestLogUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  costUsd?: number;
}

export interface RequestLogOutcome {
  status: RequestLogStatus;
  stage?: RequestLogStage;
  httpStatus?: number;
  error?: unknown;
  finishReason?: string;
  messageId?: string | null;
  analysisModel?: string;
  upstreamProvider?: string;
  knowledgeNodes?: string[];
  topics?: string[];
  usage?: RequestLogUsage;
  steps?: number;
  sqlCalls?: number;
  toolCalls?: unknown[];
  modelMs?: number;
}

export interface RequestLogRow {
  user_id: number | null;
  conversation_id: string | null;
  message_id: string | null;
  question: string;
  question_hash: string;
  page_context: string | null;
  path: RequestLogPath | null;
  analysis_model: string | null;
  upstream_provider: string | null;
  knowledge_nodes: string[] | null;
  topics: string[] | null;
  status: RequestLogStatus;
  stage: RequestLogStage | null;
  error_class: string | null;
  error_message: string | null;
  http_status: number | null;
  finish_reason: string | null;
  duration_ms: number;
  time_to_first_token_ms: number | null;
  model_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  cached_input_tokens: number | null;
  cost_usd: number | null;
  steps: number | null;
  sql_calls: number | null;
  tool_calls: string | null;
  service: string;
  commit_sha: string | null;
  region: string | null;
  origin: string | null;
  ip_hash: string | null;
}

export type RequestLogWriter = (row: RequestLogRow) => Promise<void>;

type RequestLogEnvironment = Record<string, string | undefined>;

const ERROR_MESSAGE_LIMIT = 2000;

export function resolveRequestLogService(env: RequestLogEnvironment): string {
  if (env.CLUTCH_RUNTIME === "true") return "clutch-railway";
  if (env.NETLIFY === "true") return "netlify";
  return "local";
}

function resolveCommitSha(env: RequestLogEnvironment): string | null {
  return env.RAILWAY_GIT_COMMIT_SHA?.trim() || env.COMMIT_REF?.trim() || null;
}

function hashIp(ip: string): string | null {
  if (!ip || ip === "unknown") return null;
  return createHash("sha256").update(ip).digest("hex");
}

function describeError(error: unknown): {
  error_class: string | null;
  error_message: string | null;
} {
  if (error === undefined) return { error_class: null, error_message: null };
  if (error instanceof Error) {
    return {
      error_class: error.name || error.constructor.name,
      error_message: error.message.slice(0, ERROR_MESSAGE_LIMIT),
    };
  }
  return {
    error_class: typeof error,
    error_message: String(error).slice(0, ERROR_MESSAGE_LIMIT),
  };
}

export async function insertRequestLog(row: RequestLogRow): Promise<void> {
  const sql = getConversationClient();
  await sql`
    INSERT INTO ai_request_logs (
      id, user_id, conversation_id, message_id, question, question_hash, page_context,
      path, analysis_model, upstream_provider, knowledge_nodes, topics,
      status, stage, error_class, error_message, http_status, finish_reason,
      duration_ms, time_to_first_token_ms, model_ms,
      input_tokens, output_tokens, reasoning_tokens, cached_input_tokens, cost_usd,
      steps, sql_calls, tool_calls, service, commit_sha, region, origin, ip_hash
    ) VALUES (
      gen_random_uuid(), ${row.user_id}, ${row.conversation_id}::uuid, ${row.message_id}::uuid,
      ${row.question}, ${row.question_hash}, ${row.page_context}::jsonb,
      ${row.path}, ${row.analysis_model}, ${row.upstream_provider}, ${row.knowledge_nodes}::text[], ${row.topics}::text[],
      ${row.status}, ${row.stage}, ${row.error_class}, ${row.error_message}, ${row.http_status}, ${row.finish_reason},
      ${row.duration_ms}, ${row.time_to_first_token_ms}, ${row.model_ms},
      ${row.input_tokens}, ${row.output_tokens}, ${row.reasoning_tokens}, ${row.cached_input_tokens}, ${row.cost_usd},
      ${row.steps}, ${row.sql_calls}, ${row.tool_calls}::jsonb, ${row.service}, ${row.commit_sha}, ${row.region}, ${row.origin}, ${row.ip_hash}
    )
  `;
}

export class RequestLog {
  private readonly startedAt = performance.now();
  private firstTokenAt: number | null = null;
  private finished = false;

  userId: number | null = null;
  conversationId: string | null = null;
  question = "";
  pageContext: unknown = null;
  path: RequestLogPath | null = null;

  constructor(
    private readonly context: {
      origin: string | null;
      ip: string;
      service: string;
      commitSha: string | null;
      region: string | null;
    },
    private readonly write: RequestLogWriter,
  ) {}

  markFirstToken(): void {
    if (this.firstTokenAt === null) this.firstTokenAt = performance.now();
  }

  elapsedMs(): number {
    return Math.round(performance.now() - this.startedAt);
  }

  /** Writes the row once; later calls are ignored. */
  async finish(outcome: RequestLogOutcome): Promise<void> {
    if (this.finished) return;
    this.finished = true;

    const row: RequestLogRow = {
      user_id: this.userId,
      conversation_id: this.conversationId,
      message_id: outcome.messageId ?? null,
      question: this.question,
      question_hash: createResponseCacheHash(this.question),
      page_context: this.pageContext ? JSON.stringify(this.pageContext) : null,
      path: this.path,
      analysis_model: outcome.analysisModel ?? null,
      upstream_provider: outcome.upstreamProvider ?? null,
      knowledge_nodes: outcome.knowledgeNodes ?? null,
      topics: outcome.topics ?? null,
      status: outcome.status,
      stage: outcome.stage ?? null,
      ...describeError(outcome.error),
      http_status: outcome.httpStatus ?? null,
      finish_reason: outcome.finishReason ?? null,
      duration_ms: this.elapsedMs(),
      time_to_first_token_ms:
        this.firstTokenAt === null
          ? null
          : Math.round(this.firstTokenAt - this.startedAt),
      model_ms: outcome.modelMs ?? null,
      input_tokens: outcome.usage?.inputTokens ?? null,
      output_tokens: outcome.usage?.outputTokens ?? null,
      reasoning_tokens: outcome.usage?.reasoningTokens ?? null,
      cached_input_tokens: outcome.usage?.cachedInputTokens ?? null,
      cost_usd: outcome.usage?.costUsd ?? null,
      steps: outcome.steps ?? null,
      sql_calls: outcome.sqlCalls ?? null,
      tool_calls: outcome.toolCalls ? JSON.stringify(outcome.toolCalls) : null,
      service: this.context.service,
      commit_sha: this.context.commitSha,
      region: this.context.region,
      origin: this.context.origin,
      ip_hash: hashIp(this.context.ip),
    };

    try {
      await this.write(row);
    } catch (error) {
      Sentry.captureException(error);
    }
  }
}

/** A recorder that writes nothing. Seed-mode requests are cache warmers, not traffic. */
export const noopRequestLogWriter: RequestLogWriter = async () => {};

export function beginRequestLog(
  request: Request,
  ip: string,
  options: {
    write?: RequestLogWriter;
    env?: RequestLogEnvironment;
  } = {},
): RequestLog {
  const env = options.env ?? process.env;
  return new RequestLog(
    {
      origin: request.headers.get("Origin"),
      ip,
      service: resolveRequestLogService(env),
      commitSha: resolveCommitSha(env),
      region: env.RAILWAY_REPLICA_REGION?.trim() || null,
    },
    options.write ?? insertRequestLog,
  );
}
