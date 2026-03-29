/**
 * API Configuration
 *
 * Centralizes API URL configuration and shared fetch helpers.
 * Uses NEXT_PUBLIC_API_URL environment variable for backend API base URL.
 */

import { decode } from "@msgpack/msgpack";
import type {
  ReplayData,
  ReplayListResponse,
  ReplaySeasonsResponse,
  StandingsResponse,
} from "@/lib/types";

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
/**
 * Fetches seasons that have replay data available
 */
export async function fetchReplaySeasons(): Promise<number[]> {
  const res = await fetch(apiUrl("/api/replay/seasons"), {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch replay seasons");
  const data: ReplaySeasonsResponse = await res.json();
  return data.seasons;
}

/**
 * Fetches list of available replays for a season
 */
export async function fetchAvailableReplays(
  season: number,
): Promise<ReplayListResponse> {
  const res = await fetch(apiUrl(`/api/replay/available?season=${season}`), {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch available replays");
  return res.json();
}

/**
 * Fetches and decodes replay frame data for a specific race.
 * The response is a gzip-compressed MessagePack blob that the browser
 * transparently decompresses, then we decode with @msgpack/msgpack.
 */
export async function fetchReplayData(
  season: number,
  round: number,
): Promise<ReplayData> {
  const res = await fetch(apiUrl(`/api/replay/${season}/${round}`), {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch replay data");
  const buffer = await res.arrayBuffer();
  return decode(new Uint8Array(buffer)) as ReplayData;
}

export function isValidHeadshotUrl(
  url: string | null | undefined,
): url is string {
  return !!url && url !== "None" && url !== "nan" && url.startsWith("http");
}
