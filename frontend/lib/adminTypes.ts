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

// --- Daily Grid editorial queue -------------------------------------------

export type PuzzleStatus = "draft" | "approved" | "published";

export interface PuzzleFinding {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface PuzzleAnswer {
  driver_slug: string;
  full_name: string;
  wins: number;
  entries: number;
  podiums: number;
  first_season: number | null;
  latest_season: number | null;
}

export interface PuzzleCell {
  cell_id: string;
  row_id: string;
  column_id: string;
  row_label: string;
  column_label: string;
  depth: number;
  answers: PuzzleAnswer[];
}

export interface AdminPuzzleSummary {
  number: number;
  public_id: string;
  status: PuzzleStatus;
  published_on: string | null;
  eligibility_floor: number;
  difficulty_score: number | null;
  min_depth: number;
  max_depth: number;
  error_count: number;
  warning_count: number;
  created_at: string | null;
}

/** Mirrors `GameCategory` in `lib/queries/dailyGrid.ts`, which is the player
 *  contract. Duplicated rather than imported so the admin types stay free of
 *  the query layer. */
export interface PuzzleHeader {
  id: string;
  label: string;
  prompt_label: string;
  description: string;
  visual: { kind: "constructor" | "nationality" | "text"; value: string };
}

export interface AdminPuzzleDetail extends AdminPuzzleSummary {
  rows: PuzzleHeader[];
  columns: PuzzleHeader[];
  cells: PuzzleCell[];
  findings: PuzzleFinding[];
}

export interface AdminPuzzleListResponse {
  puzzles: AdminPuzzleSummary[];
}
