/**
 * AI Database Connection
 *
 * Uses @neondatabase/serverless for direct PostgreSQL access from
 * Next.js API routes (serverless compatible).
 */

import { neon } from "@neondatabase/serverless";

const AI_DB_URL = process.env.AI_DB_URL;
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;
const AI_DB_QUERY_TIMEOUT_MS = Number.parseInt(
  process.env.AI_DB_QUERY_TIMEOUT_MS || "8000",
  10,
);

function getAISql() {
  if (!AI_DB_URL) {
    throw new Error("AI_DB_URL environment variable is not configured");
  }
  return neon(AI_DB_URL);
}

/**
 * Execute a dynamic SQL query against the F1 read-only database.
 * Used by AI tools for LLM-generated SQL.
 * Safety is enforced at the validation layer in tools.ts.
 */
export async function executeAIQuery(
  query: string,
): Promise<Record<string, unknown>[]> {
  const sql = getAISql();
  const rows = await withTimeout(sql.query(query), AI_DB_QUERY_TIMEOUT_MS);
  return rows as Record<string, unknown>[];
}

/**
 * Execute a parameterized query against the F1 read-only database.
 * Used by AI tools for schema/sample queries with known parameters.
 */
export async function executeAIParamQuery(
  query: string,
  params: unknown[],
): Promise<Record<string, unknown>[]> {
  const sql = getAISql();
  const rows = await withTimeout(
    sql.query(query, params),
    AI_DB_QUERY_TIMEOUT_MS,
  );
  return rows as Record<string, unknown>[];
}

/**
 * Returns a Neon SQL tagged template function for conversation management (read-write).
 */
export function getConversationClient() {
  if (!NEON_DATABASE_URL) {
    throw new Error("NEON_DATABASE_URL environment variable is not configured");
  }
  return neon(NEON_DATABASE_URL);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("AI database query timed out")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
