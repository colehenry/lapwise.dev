import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

const apiKey = process.env.OPEN_ROUTER_API_KEY?.trim();
if (!apiKey) {
  throw new Error(
    "OPEN_ROUTER_API_KEY is missing. Add it to the server environment and rerun npm run smoke:openrouter.",
  );
}

const modelId =
  process.env.OPENROUTER_SMOKE_MODEL || "deepseek/deepseek-v4-flash-0731";
const openrouter = createOpenRouter({
  apiKey,
  compatibility: "strict",
  appName: "Lapwise Clutch smoke test",
  appUrl: "https://lapwise.dev",
});
const startedAt = Date.now();
const result = await generateText({
  model: openrouter.chat(modelId),
  prompt:
    "Use add_numbers to add 13 and 11. After the tool returns, reply with only the total.",
  tools: {
    add_numbers: tool({
      description: "Add two numbers deterministically.",
      inputSchema: z.object({ left: z.number(), right: z.number() }),
      execute: async ({ left, right }) => ({ total: left + right }),
    }),
  },
  toolChoice: "auto",
  stopWhen: stepCountIs(3),
  providerOptions: {
    openrouter: {
      provider: { data_collection: "deny", require_parameters: true },
      usage: { include: true },
    },
  },
});

const toolCalled = result.steps.some((step) => step.toolCalls.length > 0);
const correctAnswer = /\b24\b/.test(result.text);
const providerMetadata = result.steps.at(-1)?.providerMetadata?.openrouter;
console.log(
  JSON.stringify(
    {
      ok: toolCalled && correctAnswer,
      model: result.steps.at(-1)?.response.modelId ?? modelId,
      toolCalled,
      correctAnswer,
      latencyMs: Date.now() - startedAt,
      usage: result.totalUsage,
      provider: providerMetadata?.provider,
      costUsd: providerMetadata?.usage?.cost,
    },
    null,
    2,
  ),
);

if (!toolCalled || !correctAnswer) process.exitCode = 1;
