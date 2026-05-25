import { apiUrl } from "./api";
import { fetchWithAuth } from "./auth";
import type {
  AdminDashboardPeriod,
  AdminDashboardStats,
  AdminUserListResponse,
  DiscussionTag,
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

/**
 * Creates a new discussion tag.
 */
export async function createTag(data: {
  name: string;
  color: string;
  category?: string;
}): Promise<DiscussionTag> {
  const res = await fetchWithAuth(apiUrl("/api/tags"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create tag");
  return res.json();
}

/**
 * Updates an existing tag.
 */
export async function updateTag(
  tagId: number,
  data: {
    name?: string;
    color?: string;
    category?: string;
  },
): Promise<DiscussionTag> {
  const res = await fetchWithAuth(apiUrl(`/api/tags/${tagId}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update tag");
  return res.json();
}

/**
 * Deletes a tag.
 */
export async function deleteTag(tagId: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/tags/${tagId}`), {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete tag");
}
