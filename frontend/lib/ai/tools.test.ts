import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  executeAIQuery: vi.fn(),
  executeAIParamQuery: vi.fn(),
}));

import { executeAIQuery } from "./db";
import {
  ensureLimit,
  extractReferencedTables,
  runSQLQuery,
  validateSQL,
  validateWhereClause,
} from "./tools";

const WRITE_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "CREATE",
  "EXECUTE",
  "COPY",
  "CALL",
  "MERGE",
  "VACUUM",
  "ANALYZE",
];

const RESTRICTED_TABLES = [
  "users",
  "refresh_tokens",
  "email_verification_tokens",
  "password_reset_tokens",
  "login_history",
  "posts",
  "comments",
  "votes",
  "ai_conversations",
  "ai_messages",
];

describe("validateSQL — accepts safe read-only queries", () => {
  it.each([
    "SELECT * FROM drivers",
    "SELECT full_name FROM drivers WHERE driver_code = 'VER'",
    "SELECT d.full_name FROM drivers d JOIN session_results sr ON sr.driver_id = d.id",
    "SELECT * FROM v_driver_standings",
    "SELECT * FROM v_constructor_standings",
    "SELECT * FROM drivers;",
    "  select full_name from drivers  ",
  ])("accepts %s", (sql) => {
    expect(validateSQL(sql).valid).toBe(true);
  });
});

describe("validateSQL — rejects writes and non-SELECT", () => {
  it("rejects a query that does not start with SELECT", () => {
    const result = validateSQL("WITH x AS (SELECT 1) SELECT * FROM x");
    expect(result.valid).toBe(false);
  });

  it.each(WRITE_KEYWORDS)("rejects leading %s statement", (keyword) => {
    expect(validateSQL(`${keyword} something here`).valid).toBe(false);
  });

  it("rejects a write keyword embedded in a SELECT", () => {
    expect(
      validateSQL("SELECT * FROM drivers WHERE note = 'x' OR DROP").valid,
    ).toBe(false);
  });
});

describe("validateSQL — rejects injection structure", () => {
  it("rejects stacked statements", () => {
    expect(validateSQL("SELECT * FROM drivers; DROP TABLE drivers").valid).toBe(
      false,
    );
  });

  it.each(["--", "/*", "*/"])("rejects SQL comment token %s", (token) => {
    expect(validateSQL(`SELECT * FROM drivers ${token} sneaky`).valid).toBe(
      false,
    );
  });

  it("rejects a query over the length cap", () => {
    const long = `SELECT * FROM drivers WHERE full_name = '${"a".repeat(4100)}'`;
    expect(validateSQL(long).valid).toBe(false);
  });
});

describe("validateSQL — table access control", () => {
  it.each(RESTRICTED_TABLES)("blocks restricted table %s", (table) => {
    const result = validateSQL(`SELECT * FROM ${table}`);
    expect(result.valid).toBe(false);
  });

  it("blocks the users table regardless of case", () => {
    expect(validateSQL("SELECT * FROM USERS").valid).toBe(false);
    expect(validateSQL("select * from Users").valid).toBe(false);
  });

  it("blocks a restricted table referenced via JOIN", () => {
    expect(
      validateSQL("SELECT * FROM drivers JOIN users ON users.id = drivers.id")
        .valid,
    ).toBe(false);
  });

  it("blocks a table that is not on the allowlist", () => {
    expect(validateSQL("SELECT * FROM information_schema.tables").valid).toBe(
      false,
    );
    expect(validateSQL("SELECT * FROM pg_catalog.pg_user").valid).toBe(false);
  });
});

describe("extractReferencedTables", () => {
  it("extracts FROM and JOIN targets", () => {
    const tables = extractReferencedTables(
      "SELECT * FROM drivers d JOIN teams t ON t.id = d.team_id",
    );
    expect(tables).toContain("drivers");
    expect(tables).toContain("teams");
  });

  it("normalizes quoted and schema-qualified names", () => {
    expect(extractReferencedTables('SELECT * FROM "drivers"')).toContain(
      "drivers",
    );
    expect(extractReferencedTables("SELECT * FROM public.sessions")).toContain(
      "sessions",
    );
  });
});

describe("ensureLimit", () => {
  it("wraps the query and applies the default row cap", () => {
    const wrapped = ensureLimit("SELECT * FROM drivers");
    expect(wrapped).toBe(
      "SELECT * FROM (SELECT * FROM drivers) AS ai_limited_query LIMIT 500",
    );
  });

  it("strips a trailing semicolon before wrapping", () => {
    expect(ensureLimit("SELECT * FROM drivers;")).not.toContain(";)");
  });

  it("honors a custom row cap", () => {
    expect(ensureLimit("SELECT 1", 10)).toContain("LIMIT 10");
  });
});

describe("validateWhereClause", () => {
  it("accepts a simple predicate", () => {
    expect(validateWhereClause("year = 2024").valid).toBe(true);
  });

  it("accepts a subquery against an allowlisted table", () => {
    expect(
      validateWhereClause(
        "driver_id IN (SELECT driver_id FROM session_results)",
      ).valid,
    ).toBe(true);
  });

  it.each([
    ["year = 2024; DROP TABLE drivers", "semicolon"],
    ["year = 2024 -- comment", "comment"],
    ["year = 2024 OR DELETE", "blocked keyword"],
    ["driver_id IN (SELECT id FROM users)", "restricted table"],
    ["1 = 1 UNION SELECT usename FROM pg_user", "union enumeration"],
    ["1 = 1 UNION SELECT current_user", "union without from"],
    [
      "id IN (SELECT table_name FROM information_schema.tables)",
      "system catalog",
    ],
  ])("rejects %s (%s)", (clause) => {
    expect(validateWhereClause(clause).valid).toBe(false);
  });

  it("rejects an over-length clause", () => {
    expect(validateWhereClause("a".repeat(1001)).valid).toBe(false);
  });
});

describe("runSQLQuery tool — the execution boundary", () => {
  const mockedExecuteAIQuery = vi.mocked(executeAIQuery);
  const options = { toolCallId: "test", messages: [] } as never;

  beforeEach(() => {
    mockedExecuteAIQuery.mockReset();
    mockedExecuteAIQuery.mockResolvedValue([{ full_name: "Max Verstappen" }]);
  });

  it("never reaches the database for invalid SQL", async () => {
    // biome-ignore lint/style/noNonNullAssertion: tool always defines execute
    const result = await runSQLQuery.execute!(
      { sql: "SELECT * FROM users" },
      options,
    );

    expect(mockedExecuteAIQuery).not.toHaveBeenCalled();
    expect(result).toMatchObject({ rows: [], count: 0 });
    expect(result).toHaveProperty("error");
  });

  it("never reaches the database for a write attempt", async () => {
    // biome-ignore lint/style/noNonNullAssertion: tool always defines execute
    await runSQLQuery.execute!({ sql: "DROP TABLE drivers" }, options);
    expect(mockedExecuteAIQuery).not.toHaveBeenCalled();
  });

  it("executes valid SQL through the row-limit wrapper", async () => {
    // biome-ignore lint/style/noNonNullAssertion: tool always defines execute
    const result = await runSQLQuery.execute!(
      { sql: "SELECT full_name FROM drivers" },
      options,
    );

    expect(mockedExecuteAIQuery).toHaveBeenCalledTimes(1);
    const executedSql = mockedExecuteAIQuery.mock.calls[0][0];
    expect(executedSql).toContain("ai_limited_query");
    expect(executedSql).toContain("LIMIT 500");
    expect(result).toMatchObject({ count: 1 });
  });
});
