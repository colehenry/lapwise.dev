/**
 * Anthropic provider for the AI routes.
 *
 * The SDK reads ANTHROPIC_BASE_URL straight from the environment, and agent
 * shells export it without the /v1 suffix the Messages API lives under. An
 * inherited value like that turns every request into a bare 404, and it wins
 * over .env files because Next.js never overrides an exported variable.
 */

import { createAnthropic } from "@ai-sdk/anthropic";

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";

export function resolveAnthropicBaseURL(
  configured: string | undefined = process.env.ANTHROPIC_BASE_URL,
): string {
  const trimmed = configured?.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return DEFAULT_ANTHROPIC_BASE_URL;
  }

  return /\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

export const anthropic = createAnthropic({
  baseURL: resolveAnthropicBaseURL(),
});
