/**
 * AI Database Connection
 *
 * Uses @neondatabase/serverless for direct PostgreSQL access from
 * Next.js API routes (serverless compatible).
 */

import { neon, Pool } from "@neondatabase/serverless";

const AI_DB_URL = process.env.AI_DB_URL;
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;

if (!AI_DB_URL) {
  console.warn("AI_DB_URL is not set — AI queries will fail at runtime");
}

/**
 * Execute a dynamic SQL query against the F1 read-only database.
 * Used by AI tools for LLM-generated SQL.
 * Safety is enforced at the validation layer in tools.ts.
 */
export async function executeAIQuery(
  query: string,
): Promise<Record<string, unknown>[]> {
  if (!AI_DB_URL) {
    throw new Error("AI_DB_URL environment variable is not configured");
  }
  const pool = new Pool({ connectionString: AI_DB_URL });
  try {
    const result = await pool.query(query);
    return result.rows;
  } finally {
    await pool.end();
  }
}

/**
 * Execute a parameterized query against the F1 read-only database.
 * Used by AI tools for schema/sample queries with known parameters.
 */
export async function executeAIParamQuery(
  query: string,
  params: unknown[],
): Promise<Record<string, unknown>[]> {
  if (!AI_DB_URL) {
    throw new Error("AI_DB_URL environment variable is not configured");
  }
  const pool = new Pool({ connectionString: AI_DB_URL });
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } finally {
    await pool.end();
  }
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
