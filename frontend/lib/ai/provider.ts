/** Central OpenRouter model gateway for Clutch. */

import {
  createOpenRouter,
  type OpenRouterChatSettings,
} from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

const DEFAULT_OPENROUTER_ANALYSIS_MODEL = "deepseek/deepseek-v4-flash-0731";

export type AIModelPurpose = "analysis";

type AIEnvironment = Record<string, string | undefined>;

function openRouterApiKey(env: AIEnvironment): string {
  const apiKey = env.OPEN_ROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPEN_ROUTER_API_KEY is required for Clutch model calls.");
  }
  return apiKey;
}

export interface AIProviderConfig {
  provider: "openrouter";
  modelId: string;
  purpose: AIModelPurpose;
}

export interface AIModelSelection extends AIProviderConfig {
  model: LanguageModel;
}

export interface AIProviderUsage {
  costUsd?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  upstreamProvider?: string;
}

export function resolveOpenRouterProviderRouting(
  modelId: string,
): NonNullable<OpenRouterChatSettings["provider"]> {
  const privacyAndToolSupport = {
    data_collection: "deny" as const,
    require_parameters: true,
  };
  if (modelId !== DEFAULT_OPENROUTER_ANALYSIS_MODEL) {
    return privacyAndToolSupport;
  }
  return {
    ...privacyAndToolSupport,
    order: ["deepinfra"],
    ignore: ["wafer"],
  };
}

export function resolveAIProviderConfig(
  purpose: AIModelPurpose,
  env: AIEnvironment = process.env,
): AIProviderConfig {
  const configured = env.OPENROUTER_MODEL?.trim();

  return {
    provider: "openrouter",
    purpose,
    modelId:
      configured?.includes("/") === true
        ? configured
        : DEFAULT_OPENROUTER_ANALYSIS_MODEL,
  };
}

export function getAIModel(
  purpose: AIModelPurpose,
  env: AIEnvironment = process.env,
): AIModelSelection {
  const config = resolveAIProviderConfig(purpose, env);
  const provider = createOpenRouter({
    apiKey: openRouterApiKey(env),
    compatibility: "strict",
    appName: "Lapwise Clutch",
    appUrl: env.NEXT_PUBLIC_APP_URL || "https://lapwise.dev",
  });
  return {
    ...config,
    model: provider(config.modelId, {
      provider: resolveOpenRouterProviderRouting(config.modelId),
      usage: { include: true },
    }),
  };
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function extractAIProviderUsage(metadata: unknown): AIProviderUsage {
  const root = objectValue(metadata);
  const openrouter = objectValue(root?.openrouter);
  if (!openrouter) return {};

  const usage = objectValue(openrouter.usage);
  const promptDetails = objectValue(usage?.promptTokensDetails);
  const completionDetails = objectValue(usage?.completionTokensDetails);

  return {
    costUsd: finiteNumber(usage?.cost),
    cachedInputTokens: finiteNumber(promptDetails?.cachedTokens),
    reasoningTokens: finiteNumber(completionDetails?.reasoningTokens),
    upstreamProvider:
      typeof openrouter.provider === "string" ? openrouter.provider : undefined,
  };
}
