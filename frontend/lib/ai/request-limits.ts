import type { NextRequest } from "next/server";

const AI_IP_RATE_LIMIT_PER_MINUTE = Number.parseInt(
  process.env.AI_IP_RATE_LIMIT_PER_MINUTE || "6",
  10,
);

const aiIpBuckets = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkIpRateLimit(ip: string): {
  allowed: boolean;
  retryAfter: number;
} {
  const now = Date.now();
  const existing = aiIpBuckets.get(ip);

  if (!existing || existing.resetAt <= now) {
    aiIpBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, retryAfter: 0 };
  }

  if (existing.count >= AI_IP_RATE_LIMIT_PER_MINUTE) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
}
