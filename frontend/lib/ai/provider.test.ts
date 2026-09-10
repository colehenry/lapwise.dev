import { describe, expect, it } from "vitest";
import {
  extractAIProviderUsage,
  getAIModel,
  resolveAIProviderConfig,
  resolveOpenRouterProviderRouting,
} from "./provider";

describe("resolveAIProviderConfig", () => {
  it("uses OpenRouter and DeepSeek by default", () => {
    expect(resolveAIProviderConfig("analysis", {})).toEqual({
      provider: "openrouter",
      purpose: "analysis",
      modelId: "deepseek/deepseek-v4-flash-0731",
    });
  });

  it("uses the explicit OpenRouter analysis model", () => {
    expect(
      resolveAIProviderConfig("analysis", {
        OPENROUTER_MODEL: "google/gemini-2.5-flash",
      }),
    ).toMatchObject({
      provider: "openrouter",
      modelId: "google/gemini-2.5-flash",
    });
  });

  it("rejects malformed model ids by using the default", () => {
    expect(
      resolveAIProviderConfig("analysis", {
        OPENROUTER_MODEL: "invalid-model-id",
      }).modelId,
    ).toBe("deepseek/deepseek-v4-flash-0731");
  });

  it("requires the one supported key name for model calls", () => {
    expect(() => getAIModel("analysis", {})).toThrow(
      /OPEN_ROUTER_API_KEY is required/,
    );
  });
});

describe("resolveOpenRouterProviderRouting", () => {
  it("avoids the DeepSeek endpoint that emits raw tool syntax", () => {
    expect(
      resolveOpenRouterProviderRouting("deepseek/deepseek-v4-flash-0731"),
    ).toMatchObject({
      order: ["deepinfra"],
      ignore: ["wafer"],
      require_parameters: true,
      data_collection: "deny",
    });
  });

  it("does not constrain alternate OpenRouter models", () => {
    expect(resolveOpenRouterProviderRouting("google/another-model")).toEqual({
      require_parameters: true,
      data_collection: "deny",
    });
  });
});

describe("extractAIProviderUsage", () => {
  it("normalizes OpenRouter usage and upstream metadata", () => {
    expect(
      extractAIProviderUsage({
        openrouter: {
          provider: "DeepInfra",
          usage: {
            cost: 0.0123,
            promptTokensDetails: { cachedTokens: 400 },
            completionTokensDetails: { reasoningTokens: 20 },
          },
        },
      }),
    ).toEqual({
      costUsd: 0.0123,
      cachedInputTokens: 400,
      reasoningTokens: 20,
      upstreamProvider: "DeepInfra",
    });
  });

  it("returns an empty object without OpenRouter metadata", () => {
    expect(extractAIProviderUsage(undefined)).toEqual({});
    expect(extractAIProviderUsage({ unknown: {} })).toEqual({});
  });
});
