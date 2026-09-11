import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ fetchWithAuth: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

import { streamQuestion } from "./chat";
import {
  resolveClutchAskBase,
  resolveClutchRequestRedirect,
} from "./clutch-endpoint";

function streamResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const line of lines)
          controller.enqueue(encoder.encode(`${line}\n`));
        controller.close();
      },
    }),
  );
}

beforeEach(() => vi.clearAllMocks());

describe("streamQuestion", () => {
  it("requires a terminal stream event", async () => {
    auth.fetchWithAuth.mockResolvedValue(
      streamResponse([JSON.stringify({ type: "status", stage: "starting" })]),
    );

    await expect(
      streamQuestion("Question", undefined, vi.fn()),
    ).rejects.toThrow(/lost the connection before finishing/i);
  });

  it("accepts a stream completed by metadata", async () => {
    auth.fetchWithAuth.mockResolvedValue(
      streamResponse([
        JSON.stringify({ type: "status", stage: "starting" }),
        JSON.stringify({
          type: "metadata",
          conversationId: "conversation",
          remaining: 2,
          charts: [],
          queries: [],
          followUps: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        }),
      ]),
    );

    await expect(
      streamQuestion("Question", undefined, vi.fn()),
    ).resolves.toBeUndefined();
  });
});

describe("resolveClutchAskBase", () => {
  it("uses the Railway origin only for Clutch requests", () => {
    expect(resolveClutchAskBase(" https://clutch.example/ ", "/api/ai")).toBe(
      "https://clutch.example/api/ai",
    );
    expect(resolveClutchAskBase(undefined, "/api/ai")).toBe("/api/ai");
  });

  it("redirects a Netlify fallback request but not the Railway request", () => {
    expect(
      resolveClutchRequestRedirect(
        "https://clutch.example",
        "https://lapwise.dev/api/ai/ask",
      ),
    ).toBe("https://clutch.example/api/ai/ask");
    expect(
      resolveClutchRequestRedirect(
        "https://clutch.example",
        "https://clutch.example/api/ai/ask",
      ),
    ).toBeNull();
  });
});
