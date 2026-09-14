import { describe, expect, it } from "vitest";
import {
  beginRequestLog,
  type RequestLogRow,
  resolveRequestLogService,
} from "./request-log";

function capture() {
  const rows: RequestLogRow[] = [];
  const write = async (row: RequestLogRow) => {
    rows.push(row);
  };
  return { rows, write };
}

describe("request log", () => {
  it("names the runtime from environment", () => {
    expect(resolveRequestLogService({ CLUTCH_RUNTIME: "true" })).toBe(
      "clutch-railway",
    );
    expect(resolveRequestLogService({ NETLIFY: "true" })).toBe("netlify");
    expect(resolveRequestLogService({})).toBe("local");
  });

  it("records a rejected request with origin, hashed ip, and deployment", async () => {
    const { rows, write } = capture();
    const log = beginRequestLog(
      new Request("http://localhost/api/ai/ask", {
        headers: { Origin: "https://lapwise.dev" },
      }),
      "203.0.113.9",
      {
        write,
        env: {
          CLUTCH_RUNTIME: "true",
          RAILWAY_GIT_COMMIT_SHA: "abc123",
          RAILWAY_REPLICA_REGION: "us-west2",
        },
      },
    );
    await log.finish({ status: "rejected", stage: "auth", httpStatus: 401 });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "rejected",
      stage: "auth",
      http_status: 401,
      origin: "https://lapwise.dev",
      service: "clutch-railway",
      commit_sha: "abc123",
      region: "us-west2",
      user_id: null,
      path: null,
    });
    expect(rows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].ip_hash).not.toContain("203.0.113.9");
    expect(rows[0].duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("captures error class and message, and writes only once", async () => {
    const { rows, write } = capture();
    const log = beginRequestLog(
      new Request("http://localhost/api/ai/ask"),
      "unknown",
      { write },
    );
    log.question = "does fastest lap still award a bonus point?";
    log.path = "agent";
    const error = new Error("Connect Timeout Error");
    error.name = "AI_RetryError";

    await log.finish({
      status: "error",
      stage: "model",
      httpStatus: 200,
      error,
      usage: { inputTokens: 10, outputTokens: 0, costUsd: 0.00001 },
      toolCalls: [{ tool: "run_sql_query", sql: "SELECT 1" }],
    });
    await log.finish({ status: "ok" });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "error",
      stage: "model",
      error_class: "AI_RetryError",
      error_message: "Connect Timeout Error",
      input_tokens: 10,
      cost_usd: 0.00001,
      ip_hash: null,
      question: "does fastest lap still award a bonus point?",
    });
    expect(rows[0].question_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(rows[0].tool_calls ?? "[]")).toEqual([
      { tool: "run_sql_query", sql: "SELECT 1" },
    ]);
  });

  it("never throws when the write fails", async () => {
    const log = beginRequestLog(
      new Request("http://localhost/api/ai/ask"),
      "unknown",
      {
        write: async () => {
          throw new Error("db down");
        },
      },
    );
    await expect(log.finish({ status: "ok" })).resolves.toBeUndefined();
  });
});
