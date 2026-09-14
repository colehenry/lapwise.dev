import { queryOptions } from "@tanstack/react-query";
import { apiUrl, extractErrorMessage } from "@/lib/api";
import { fetchWithAuth } from "@/lib/auth";
import type { GameCategory } from "./dailyGrid";
import { hours } from "./durations";

// Answers are exposed in full here, which is the opposite of the player
// contract: a reviewer approving a board has to read the names.

export type PuzzleStatus = "draft" | "approved" | "published";

export type PuzzleFinding = {
  level: "error" | "warning";
  code: string;
  message: string;
};

export type PuzzleAnswer = {
  driver_slug: string;
  full_name: string;
  wins: number;
  entries: number;
  podiums: number;
  first_season: number | null;
  latest_season: number | null;
};

export type PuzzleCell = {
  cell_id: string;
  row_id: string;
  column_id: string;
  row_label: string;
  column_label: string;
  depth: number;
  answers: PuzzleAnswer[];
};

export type AdminPuzzleSummary = {
  number: number;
  public_id: string;
  status: PuzzleStatus;
  published_on: string | null;
  eligibility_floor: number;
  difficulty_score: number | null;
  min_depth: number;
  max_depth: number;
  /** Row-major, nine entries for a complete board. */
  cell_depths: number[];
  error_count: number;
  warning_count: number;
  created_at: string | null;
};

export type AdminPuzzleDetail = AdminPuzzleSummary & {
  rows: GameCategory[];
  columns: GameCategory[];
  cells: PuzzleCell[];
  findings: PuzzleFinding[];
};

export type PuzzleHeaderOption = {
  id: string;
  label: string;
  prompt_label: string;
  kind: string;
  /** Eligible drivers satisfying the header alone, before any intersection. */
  depth: number;
  /** Their slugs, so a picker can count intersections locally. */
  answers: string[];
};

export type PuzzleHeaderCatalog = {
  eligibility_floor: number;
  pool_size: number;
  headers: PuzzleHeaderOption[];
};

/** Six header ids in board order. A null slot is one still being chosen. */
export type PuzzleHeaders = {
  eligibility_floor: number;
  rows: (string | null)[];
  columns: (string | null)[];
};

export type PuzzlePreview = {
  pool_size: number;
  cells: PuzzleCell[];
  findings: PuzzleFinding[];
  difficulty_score: number | null;
  /** One distinct driver per cell, keyed by cell id; null until the board
   *  is complete and completable. */
  solution: Record<string, PuzzleAnswer> | null;
};

export type PuzzleGenerateRequest = {
  count: number;
  eligibility_floor: number;
  theme: string[];
};

export const adminGridKeys = {
  all: ["admin", "grid"] as const,
  queue: ["admin", "grid", "queue"] as const,
  detail: (number: number) => ["admin", "grid", "detail", number] as const,
  headers: (floor: number) => ["admin", "grid", "headers", floor] as const,
  preview: (headers: PuzzleHeaders) =>
    ["admin", "grid", "preview", headers] as const,
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(apiUrl(path), init);
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "Admin action failed"));
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function adminGridQueueQuery() {
  return queryOptions({
    queryKey: adminGridKeys.queue,
    queryFn: () =>
      request<{ puzzles: AdminPuzzleSummary[] }>("/api/admin/puzzles"),
    staleTime: 0,
  });
}

export function adminGridDetailQuery(number: number) {
  return queryOptions({
    queryKey: adminGridKeys.detail(number),
    queryFn: () => request<AdminPuzzleDetail>(`/api/admin/puzzles/${number}`),
    staleTime: 0,
  });
}

/** The first call at a floor builds the catalog on the server and is slow;
 *  every later one is served from memory. */
export function adminGridHeadersQuery(floor: number) {
  return queryOptions({
    queryKey: adminGridKeys.headers(floor),
    queryFn: () =>
      request<PuzzleHeaderCatalog>(`/api/admin/puzzles/headers?floor=${floor}`),
    staleTime: hours(1),
  });
}

export function adminGridPreviewQuery(headers: PuzzleHeaders) {
  const chosen = [...headers.rows, ...headers.columns].some(Boolean);
  return queryOptions({
    queryKey: adminGridKeys.preview(headers),
    queryFn: () =>
      request<PuzzlePreview>(
        "/api/admin/puzzles/preview",
        json("POST", headers),
      ),
    enabled: chosen,
    staleTime: hours(1),
  });
}

export function adminGridInvalidation() {
  return { queryKey: adminGridKeys.all };
}

export function generateAdminGridPuzzles(body: PuzzleGenerateRequest) {
  return request<{ requested: number; created: AdminPuzzleSummary[] }>(
    "/api/admin/puzzles/generate",
    json("POST", { ...body, seed: null }),
  );
}

export function createAdminGridPuzzle(headers: PuzzleHeaders) {
  return request<AdminPuzzleSummary>(
    "/api/admin/puzzles",
    json("POST", headers),
  );
}

export function replaceAdminGridHeaders(
  number: number,
  headers: PuzzleHeaders,
) {
  return request<AdminPuzzleSummary>(
    `/api/admin/puzzles/${number}/headers`,
    json("PUT", headers),
  );
}

export function approveAdminGridPuzzle(number: number) {
  return request<{ published_on: string }>(
    `/api/admin/puzzles/${number}/approve`,
    { method: "PUT" },
  );
}

export function moveAdminGridPuzzle(number: number, publishedOn: string) {
  return request<{ published_on: string }>(
    `/api/admin/puzzles/${number}/date`,
    json("PUT", { published_on: publishedOn }),
  );
}

export function revertAdminGridPuzzle(number: number) {
  return request(`/api/admin/puzzles/${number}/revert`, { method: "PUT" });
}

export function deleteAdminGridPuzzle(number: number) {
  return request<void>(`/api/admin/puzzles/${number}`, { method: "DELETE" });
}

export function deleteAdminGridDrafts() {
  return request<{ deleted: number }>("/api/admin/puzzles/drafts", {
    method: "DELETE",
  });
}
