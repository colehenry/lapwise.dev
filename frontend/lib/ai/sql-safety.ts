import { ALLOWED_AI_TABLES } from "./allowed-tables";

const BLOCKED_SQL_PATTERNS =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE|EXECUTE|COPY|CALL|MERGE|VACUUM|ANALYZE)\b/i;
const SQL_COMMENT_PATTERN = /(--|\/\*|\*\/)/;
const MAX_SQL_LENGTH = 4000;
const RESTRICTED_TABLES = [
  "users",
  "refresh_tokens",
  "email_verification_tokens",
  "password_reset_tokens",
  "login_history",
  "posts",
  "comments",
  "votes",
  "tags",
  "post_tags",
  "ai_conversations",
  "ai_messages",
];

function checkRestrictedTables(
  sql: string,
): { valid: true } | { valid: false; error: string } {
  for (const table of RESTRICTED_TABLES) {
    if (new RegExp(`\\b${table}\\b`, "i").test(sql)) {
      return {
        valid: false,
        error: `Access to table '${table}' is not permitted. Only F1 data tables are queryable.`,
      };
    }
  }
  return { valid: true };
}

function normalizeTableName(raw: string): string {
  return raw.replaceAll('"', "").split(".").pop()?.toLowerCase() ?? "";
}

export function extractReferencedTables(sql: string): string[] {
  const tables = new Set<string>();
  const pattern =
    /\b(?:FROM|JOIN)\s+("?[a-zA-Z_][\w]*"?(?:\."?[a-zA-Z_][\w]*"?)?)/gi;
  for (const match of sql.matchAll(pattern)) {
    const table = normalizeTableName(match[1]);
    if (table) tables.add(table);
  }
  return [...tables];
}

function checkAllowedTables(
  sql: string,
): { valid: true } | { valid: false; error: string } {
  for (const table of extractReferencedTables(sql)) {
    if (!ALLOWED_AI_TABLES.includes(table as never)) {
      return {
        valid: false,
        error: `Access to table '${table}' is not permitted. Allowed tables: ${ALLOWED_AI_TABLES.join(", ")}`,
      };
    }
  }
  return { valid: true };
}

export function validateSQL(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim();
  if (trimmed.length > MAX_SQL_LENGTH) {
    return {
      valid: false,
      error: `Query is too long. Maximum length is ${MAX_SQL_LENGTH} characters.`,
    };
  }
  if (!trimmed.toUpperCase().startsWith("SELECT")) {
    return { valid: false, error: "Only SELECT queries are allowed." };
  }
  if (
    trimmed.replace(/;\s*$/, "").includes(";") ||
    SQL_COMMENT_PATTERN.test(trimmed)
  ) {
    return { valid: false, error: "Query contains unsafe SQL syntax." };
  }
  if (BLOCKED_SQL_PATTERNS.test(trimmed)) {
    return {
      valid: false,
      error:
        "Query contains blocked keywords. Only read-only SELECT queries are permitted.",
    };
  }
  const restricted = checkRestrictedTables(trimmed);
  if (!restricted.valid) return restricted;
  const allowed = checkAllowedTables(trimmed);
  return allowed.valid ? { valid: true } : allowed;
}

export function ensureLimit(sql: string, maxRows = 500): string {
  const cleaned = sql.replace(/;\s*$/, "");
  return `SELECT * FROM (${cleaned}) AS ai_limited_query LIMIT ${maxRows}`;
}

export function validateWhereClause(
  whereClause: string,
): { valid: true } | { valid: false; error: string } {
  if (
    whereClause.length > 1000 ||
    whereClause.includes(";") ||
    SQL_COMMENT_PATTERN.test(whereClause)
  ) {
    return { valid: false, error: "WHERE clause contains unsafe SQL syntax." };
  }
  if (
    BLOCKED_SQL_PATTERNS.test(whereClause) ||
    /\bUNION\b/i.test(whereClause)
  ) {
    return { valid: false, error: "WHERE clause contains blocked keywords." };
  }
  const restricted = checkRestrictedTables(whereClause);
  if (!restricted.valid) return restricted;
  return checkAllowedTables(whereClause);
}
