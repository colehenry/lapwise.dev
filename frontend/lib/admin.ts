import { apiUrl } from "./api";
import { fetchWithAuth } from "./auth";
import type {
  AdminCommentListResponse,
  AdminDashboardPeriod,
  AdminDashboardStats,
  AdminUserListResponse,
  UserProfile,
} from "./types";

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
