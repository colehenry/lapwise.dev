// Admin API type definitions. Separate from `types.ts` because these describe
// admin-only responses, which carry data the player contract withholds.

import type { CommentAuthor, UserProfile } from "./types";

export interface AdminActivity {
  id: number;
  user_id: number | null;
  username: string | null;
  ip_address: string;
  user_agent: string | null;
  success: boolean;
  created_at: string;
}

export type AdminDashboardPeriod = "all" | "month" | "week" | "24h";

export interface AdminDashboardStats {
  user_count: number;
  active_users: number;
  comment_count: number;
  total_ai_queries: number;
  recent_activity: AdminActivity[];
}

export interface AdminUserListResponse {
  users: UserProfile[];
  total: number;
  page: number;
  size: number;
}

export interface AdminCommentListItem {
  id: number;
  parent_comment_id: number | null;
  body: string;
  vote_count: number;
  author: CommentAuthor;
  year: number;
  round: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminCommentListResponse {
  comments: AdminCommentListItem[];
  next_cursor: string | null;
}
