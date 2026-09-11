export function resolveClutchAskBase(
  configuredOrigin: string | undefined,
  fallback = "/api/ai",
): string {
  const origin = configuredOrigin?.trim().replace(/\/+$/, "");
  return origin ? `${origin}/api/ai` : fallback;
}

export function resolveClutchRequestRedirect(
  configuredOrigin: string | undefined,
  requestUrl: string,
): string | null {
  if (!configuredOrigin?.trim()) return null;

  try {
    const request = new URL(requestUrl);
    const clutch = new URL(configuredOrigin);
    if (request.origin === clutch.origin) return null;
    return new URL("/api/ai/ask", clutch.origin).toString();
  } catch {
    return null;
  }
}

export const CLUTCH_ASK_BASE = resolveClutchAskBase(
  process.env.NEXT_PUBLIC_CLUTCH_API_URL,
);
