/**
 * AI Database Connection
 *
 * Uses @neondatabase/serverless for direct PostgreSQL access from
 * Next.js API routes (serverless compatible).
 */

import { neon } from "@neondatabase/serverless";

const AI_DB_URL = process.env.AI_DB_URL;
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;

if (!AI_DB_URL) {
  console.warn("AI_DB_URL is not set — AI queries will fail at runtime");
}

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
  const rows = await sql.query(query);
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
  const rows = await sql.query(query, params);
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
