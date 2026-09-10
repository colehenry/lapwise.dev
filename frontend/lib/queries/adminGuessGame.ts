import { queryOptions } from "@tanstack/react-query";
import { apiUrl, extractErrorMessage } from "@/lib/api";
import { fetchWithAuth } from "@/lib/auth";

export type AdminGuessPuzzle = {
  number: number;
  public_id: string;
  status: "draft" | "approved" | "published";
  published_on: string | null;
  max_guesses: number;
  driver_slug: string;
  full_name: string;
  driver_code: string | null;
  debut: number;
  last_raced: number;
  country: string;
  constructor: string;
  career_peak: string;
  created_at: string | null;
};

export const adminGuessGameKeys = {
  queue: ["admin", "guess-game", "queue"] as const,
};

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(apiUrl(path), init);
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "Admin action failed"));
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export function adminGuessGameQueueQuery() {
  return queryOptions({
    queryKey: adminGuessGameKeys.queue,
    queryFn: () =>
      adminRequest<{ puzzles: AdminGuessPuzzle[] }>("/api/admin/guess-puzzles"),
    staleTime: 0,
  });
}

export function adminGuessGameInvalidation() {
  return { queryKey: adminGuessGameKeys.queue };
}

export function generateAdminGuessPuzzles(count: number) {
  return adminRequest("/api/admin/guess-puzzles/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count }),
  });
}

export function scheduleAdminGuessPuzzle(number: number, publishedOn: string) {
  return adminRequest(`/api/admin/guess-puzzles/${number}/schedule`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ published_on: publishedOn }),
  });
}

export function revertAdminGuessPuzzle(number: number) {
  return adminRequest(`/api/admin/guess-puzzles/${number}/revert`, {
    method: "PUT",
  });
}

export function deleteAdminGuessPuzzle(number: number) {
  return adminRequest<void>(`/api/admin/guess-puzzles/${number}`, {
    method: "DELETE",
  });
}

export function deleteAdminGuessDrafts() {
  return adminRequest<{ deleted: number }>("/api/admin/guess-puzzles/drafts", {
    method: "DELETE",
  });
}
