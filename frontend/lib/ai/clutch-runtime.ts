const REQUIRED_CLUTCH_ENVIRONMENT = [
  "OPEN_ROUTER_API_KEY",
  "AI_DB_URL",
  "NEON_DATABASE_URL",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_API_KEY",
] as const;

type ClutchRuntimeEnvironment = Record<string, string | undefined>;

export function missingClutchEnvironment(
  env: ClutchRuntimeEnvironment = process.env,
): string[] {
  return REQUIRED_CLUTCH_ENVIRONMENT.filter((name) => !env[name]?.trim());
}
