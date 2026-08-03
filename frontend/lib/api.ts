/**
 * API Configuration
 *
 * Centralizes API URL configuration and shared fetch helpers.
 * Uses NEXT_PUBLIC_API_URL environment variable for backend API base URL.
 */

import { decode } from "@msgpack/msgpack";
import {
  expandPreviewArtifact,
  type ReplayPreviewArtifact,
} from "@/lib/replayPreviewArtifact";
import type {
  ReplayData,
  ReplayListResponse,
  ReplaySeasonsResponse,
  ReplayTrackResponse,
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
 * Extracts a human-readable error message from a FastAPI error response.
 * Handles both HTTPException-style string `detail` and Pydantic validation
 * errors, where `detail` is an array of `{ msg, loc, type }` objects.
 *
 * Without this, code that does `throw new Error(err.detail)` ends up
 * stringifying the array to "[object Object]".
 */
export async function extractErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  const body = await res.json().catch(() => null);
  if (!body) return fallback;
  const detail = body.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && typeof item.msg === "string") {
          return item.msg.replace(/^Value error,\s*/i, "");
        }
        return null;
      })
      .filter((m): m is string => !!m);
    if (messages.length > 0) return messages.join(". ");
  }
  if (typeof body.message === "string") return body.message;
  return fallback;
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
    // Server renders revalidate on this interval; browsers ignore `next`.
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error("Failed to fetch standings");
  return res.json();
}

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

/**
 * Fetches the downsampled autoplay artifact for the most recent race.
 *
 * One request resolves the latest race and its frames, and the payload is
 * roughly 26x smaller than the full replay blob.
 */
export async function fetchLatestReplayPreview(): Promise<ReplayData | null> {
  const res = await fetch(apiUrl("/api/replay/preview/latest"), {
    headers: apiHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch replay preview");
  const buffer = await res.arrayBuffer();
  return expandPreviewArtifact(
    decode(new Uint8Array(buffer)) as ReplayPreviewArtifact,
  );
}

/**
 * Fetches lightweight replay-backed track geometry for a circuit.
 */
export async function fetchReplayTrackGeometry(
  circuitId: number,
): Promise<ReplayTrackResponse | null> {
  const res = await fetch(apiUrl(`/api/replay/track/${circuitId}`), {
    headers: apiHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch replay track geometry");
  return res.json();
}

export function isValidHeadshotUrl(
  url: string | null | undefined,
): url is string {
  return !!url && url !== "None" && url !== "nan" && url.startsWith("http");
}
