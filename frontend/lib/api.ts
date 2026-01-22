/**
 * API Configuration
 *
 * Centralizes API URL configuration for the application.
 * Uses NEXT_PUBLIC_API_URL environment variable for backend API base URL.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

/**
 * Constructs a full API URL from a path
 *
 * @param path - API path (e.g., "/api/results/seasons")
 * @returns Full URL to the API endpoint
 *
 * @example
 * ```ts
 * const url = apiUrl("/api/results/2024");
 * // Returns: "https://your-backend.railway.app/api/results/2024"
 * ```
 */
export const apiUrl = (path: string): string => {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

/**
 * Returns headers object with API key for authenticated requests
 *
 * @returns Headers object with X-API-Key header
 *
 * @example
 * ```ts
 * fetch(apiUrl("/api/results/seasons"), { headers: apiHeaders() })
 * ```
 */
export const apiHeaders = (): HeadersInit => {
  return {
    "X-API-Key": API_KEY,
  };
};
