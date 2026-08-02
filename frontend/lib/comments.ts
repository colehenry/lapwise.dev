import { apiUrl } from "@/lib/api";
import { fetchWithAuth } from "@/lib/auth";
import type { CommentResponse, RaceCommentsResponse } from "@/lib/types";

function buildQuery(
  params: Record<string, string | number | null | undefined>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail =
      typeof err?.detail === "string" ? err.detail : "Request failed";
    throw new Error(detail);
  }
  return res.json();
}

async function expectOk(res: Response): Promise<void> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail =
      typeof err?.detail === "string" ? err.detail : "Request failed";
    throw new Error(detail);
  }
}

export async function fetchRaceComments(params: {
  season: number;
  round: number;
  cursor?: string | null;
  limit?: number;
  sort?: "new" | "top";
}): Promise<RaceCommentsResponse> {
  const query = buildQuery({
    cursor: params.cursor,
    limit: params.limit,
    sort: params.sort,
  });
  const res = await fetchWithAuth(
    apiUrl(`/api/comments/races/${params.season}/${params.round}${query}`),
  );
  return parseJson<RaceCommentsResponse>(res);
}

export async function createComment(data: {
  season: number;
  round: number;
  body: string;
  parent_comment_id?: number | null;
}): Promise<CommentResponse> {
  const res = await fetchWithAuth(
    apiUrl(`/api/comments/races/${data.season}/${data.round}`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: data.body,
        parent_comment_id: data.parent_comment_id ?? null,
      }),
    },
  );
  return parseJson<CommentResponse>(res);
}

export async function updateComment(
  commentId: number,
  body: string,
): Promise<CommentResponse> {
  const res = await fetchWithAuth(apiUrl(`/api/comments/${commentId}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  return parseJson<CommentResponse>(res);
}

export async function deleteComment(commentId: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/comments/${commentId}`), {
    method: "DELETE",
  });
  await expectOk(res);
}

export async function voteComment(
  commentId: number,
): Promise<{ voted: boolean; new_count: number }> {
  const res = await fetchWithAuth(apiUrl(`/api/comments/${commentId}/vote`), {
    method: "POST",
  });
  return parseJson<{ voted: boolean; new_count: number }>(res);
}
