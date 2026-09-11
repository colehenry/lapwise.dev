import { describe, expect, it, vi } from "vitest";

const calls: { text: string; values: unknown[] }[] = [];
vi.mock("./db", () => ({
  getConversationClient:
    () =>
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ text: strings.join("?"), values });
      return Promise.resolve([]);
    },
}));

import { insertRequestLog, type RequestLogRow } from "./request-log";

describe("request log insert", () => {
  it("binds one value per column after the generated id", async () => {
    const row: RequestLogRow = {
      user_id: 1,
      conversation_id: null,
      message_id: null,
      question: "q",
      question_hash: "h",
      page_context: null,
      path: "agent",
      analysis_model: null,
      upstream_provider: null,
      knowledge_nodes: ["fastest-lap-bonus"],
      topics: ["rules"],
      status: "ok",
      stage: null,
      error_class: null,
      error_message: null,
      http_status: 200,
      finish_reason: "stop",
      duration_ms: 12,
      time_to_first_token_ms: 5,
      model_ms: 10,
      input_tokens: 1,
      output_tokens: 2,
      reasoning_tokens: null,
      cached_input_tokens: null,
      cost_usd: null,
      steps: 1,
      sql_calls: 0,
      tool_calls: null,
      service: "local",
      commit_sha: null,
      region: null,
      origin: null,
      ip_hash: null,
    };
    await insertRequestLog(row);

    expect(calls).toHaveLength(1);
    const columns = calls[0].text
      .slice(calls[0].text.indexOf("(") + 1, calls[0].text.indexOf(")"))
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean);
    expect(columns).toHaveLength(Object.keys(row).length + 1);
    expect(calls[0].values).toHaveLength(Object.keys(row).length);
    expect(calls[0].values[columns.indexOf("status") - 1]).toBe("ok");
    expect(calls[0].values[columns.indexOf("finish_reason") - 1]).toBe("stop");
    expect(calls[0].values[columns.indexOf("ip_hash") - 1]).toBeNull();
  });
});
