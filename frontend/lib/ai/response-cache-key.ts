import crypto from "node:crypto";

export const AI_RESPONSE_CACHE_VERSION =
  process.env.AI_RESPONSE_CACHE_VERSION || "clutch-v3";

export function createResponseCacheHash(question: string): string {
  return crypto
    .createHash("sha256")
    .update(`${AI_RESPONSE_CACHE_VERSION}:${question.toLowerCase().trim()}`)
    .digest("hex");
}
