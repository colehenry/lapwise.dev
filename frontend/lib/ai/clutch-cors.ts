const DEFAULT_ALLOWED_ORIGINS = [
  "https://lapwise.dev",
  "https://www.lapwise.dev",
  "http://localhost:3000",
];

type ClutchCorsEnvironment = Record<string, string | undefined>;

function allowedOrigins(env: ClutchCorsEnvironment): Set<string> {
  const configured = env.CLUTCH_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set(
    configured && configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS,
  );
}

function appendVary(headers: Headers, value: string): void {
  const values = new Set(
    (headers.get("Vary") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  values.add(value);
  headers.set("Vary", [...values].join(", "));
}

function applyClutchCors(
  request: Request,
  headers: Headers,
  env: ClutchCorsEnvironment,
): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  if (!allowedOrigins(env).has(origin)) return false;

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-API-Key",
  );
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  appendVary(headers, "Origin");
  return true;
}

export function withClutchCors(
  request: Request,
  response: Response,
  env: ClutchCorsEnvironment = process.env,
): Response {
  applyClutchCors(request, response.headers, env);
  return response;
}

export function createClutchPreflightResponse(
  request: Request,
  env: ClutchCorsEnvironment = process.env,
): Response {
  const headers = new Headers();
  const allowed = applyClutchCors(request, headers, env);
  return new Response(null, { status: allowed ? 204 : 403, headers });
}
