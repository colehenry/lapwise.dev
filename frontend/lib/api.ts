/**
 * API Configuration
 *
 * Centralizes API URL configuration and shared fetch helpers.
 * Uses NEXT_PUBLIC_API_URL environment variable for backend API base URL.
 */

import type { StandingsResponse } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

/**
 * Constructs a full API URL from a path
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Returns headers object with API key for authenticated requests
 */
export function apiHeaders(): HeadersInit {
  return {
    "X-API-Key": API_KEY,
  };
}

/**
 * Fetches the list of available seasons
 */
export async function fetchSeasons(): Promise<number[]> {
  const res = await fetch(apiUrl("/api/results/seasons"), {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch seasons");
  return res.json();
}

/**
 * Fetches driver and constructor standings for a given season
 */
export async function fetchStandings(
  season: number,
): Promise<StandingsResponse> {
  const res = await fetch(apiUrl(`/api/results/${season}/standings`), {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch standings");
  return res.json();
}

/**
 * Returns true if the headshot URL is a valid, loadable image URL.
 * Filters out null, "None", "nan", and non-http values.
 */
export function isValidHeadshotUrl(
  url: string | null | undefined,
): url is string {
  return !!url && url !== "None" && url !== "nan" && url.startsWith("http");
}
