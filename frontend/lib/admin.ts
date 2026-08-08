import type {
  AdminCommentListResponse,
  AdminDashboardPeriod,
  AdminDashboardStats,
  AdminPuzzleDetail,
  AdminPuzzleListResponse,
  AdminUserListResponse,
  PuzzleGenerateRequest,
  PuzzleGenerateResponse,
  PuzzleStatus,
} from "./adminTypes";
import { apiUrl } from "./api";
import { fetchWithAuth } from "./auth";
import type { UserProfile } from "./types";

export async function fetchAdminDashboardStats(
  period: AdminDashboardPeriod = "all",
): Promise<AdminDashboardStats> {
  const res = await fetchWithAuth(
    apiUrl(`/api/admin/dashboard?period=${period}`),
  );
  if (!res.ok) throw new Error("Failed to fetch admin stats");
  return res.json();
}

/**
 * Lists users for the admin panel.
 */
export async function fetchAdminUsers(
  page = 1,
  size = 20,
  query?: string,
): Promise<AdminUserListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    size: size.toString(),
  });
  if (query) params.append("query", query);

  const res = await fetchWithAuth(apiUrl(`/api/admin/users?${params}`));
  if (!res.ok) throw new Error("Failed to fetch admin users");
  return res.json();
}

/**
 * Updates a user's role.
 */
export async function updateUserRole(
  userId: number,
  role: string,
): Promise<UserProfile> {
  const res = await fetchWithAuth(apiUrl(`/api/admin/users/${userId}/role`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("Failed to update user role");
  return res.json();
}

/**
 * Updates a user's status (active/inactive).
 */
export async function updateUserStatus(
  userId: number,
  isActive: boolean,
): Promise<UserProfile> {
  const res = await fetchWithAuth(apiUrl(`/api/admin/users/${userId}/status`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) throw new Error("Failed to update user status");
  return res.json();
}

export async function fetchAdminComments(
  cursor?: string | null,
  limit = 50,
): Promise<AdminCommentListResponse> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (cursor) params.append("cursor", cursor);
  const res = await fetchWithAuth(apiUrl(`/api/admin/comments?${params}`));
  if (!res.ok) throw new Error("Failed to fetch admin comments");
  return res.json();
}

export async function adminDeleteComment(commentId: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/admin/comments/${commentId}`), {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete comment");
}

export async function adminRestoreComment(commentId: number): Promise<void> {
  const res = await fetchWithAuth(
    apiUrl(`/api/admin/comments/${commentId}/restore`),
    { method: "PUT" },
  );
  if (!res.ok) throw new Error("Failed to restore comment");
}

export async function adminSetThreadLock(
  year: number,
  round: number,
  isLocked: boolean,
): Promise<void> {
  const res = await fetchWithAuth(
    apiUrl(`/api/admin/races/${year}/${round}/lock`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_locked: isLocked }),
    },
  );
  if (!res.ok) throw new Error("Failed to update thread lock");
}

/**
 * Lists boards in the editorial queue. Returns complete answer sets, so every
 * call here is admin-only on the server.
 */
export async function fetchAdminPuzzles(
  status?: PuzzleStatus,
): Promise<AdminPuzzleListResponse> {
  const query = status ? `?status=${status}` : "";
  const res = await fetchWithAuth(apiUrl(`/api/admin/puzzles${query}`));
  if (!res.ok) throw new Error("Failed to fetch puzzles");
  return res.json();
}

/** Proposes boards as drafts. Loading the driver pool and header catalog
 *  dominates the cost, so a batch of ten costs about what one does — and the
 *  request runs for seconds rather than milliseconds. */
export async function adminGeneratePuzzles(
  request: PuzzleGenerateRequest,
): Promise<PuzzleGenerateResponse> {
  const res = await fetchWithAuth(apiUrl("/api/admin/puzzles/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok)
    throw new Error(await extractAdminError(res, "Failed to generate boards"));
  return res.json();
}

export async function fetchAdminPuzzle(
  number: number,
): Promise<AdminPuzzleDetail> {
  const res = await fetchWithAuth(apiUrl(`/api/admin/puzzles/${number}`));
  if (!res.ok) throw new Error("Failed to fetch puzzle");
  return res.json();
}

/** Approving a board is also dating it; the date gate does the publishing. */
export async function adminSchedulePuzzle(
  number: number,
  publishedOn: string,
): Promise<void> {
  const res = await fetchWithAuth(
    apiUrl(`/api/admin/puzzles/${number}/schedule`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published_on: publishedOn, status: "published" }),
    },
  );
  if (!res.ok)
    throw new Error(await extractAdminError(res, "Failed to schedule"));
}

export async function adminRevertPuzzle(number: number): Promise<void> {
  const res = await fetchWithAuth(
    apiUrl(`/api/admin/puzzles/${number}/revert`),
    {
      method: "PUT",
    },
  );
  if (!res.ok)
    throw new Error(await extractAdminError(res, "Failed to revert"));
}

export async function adminDeletePuzzle(number: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/admin/puzzles/${number}`), {
    method: "DELETE",
  });
  if (!res.ok)
    throw new Error(await extractAdminError(res, "Failed to delete"));
}

/** The API refuses scheduling for reasons a reviewer needs to read — a date
 *  clash, or validator errors — so the detail is surfaced rather than dropped. */
async function extractAdminError(res: Response, fallback: string) {
  try {
    const body = await res.json();
    return typeof body?.detail === "string" ? body.detail : fallback;
  } catch {
    return fallback;
  }
}
