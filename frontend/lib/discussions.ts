import { apiUrl } from "@/lib/api";
import { fetchWithAuth } from "@/lib/auth";
import type {
  CommentListResponse,
  CommentResponse,
  DiscussionTag,
  PostListResponse,
  PostResponse,
} from "@/lib/types";

function buildQuery(params: Record<string, string | number | null | undefined>) {
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

export async function fetchTags(): Promise<DiscussionTag[]> {
  const res = await fetch(apiUrl("/api/tags"));
  const data = await parseJson<{ tags: DiscussionTag[] }>(res);
  return data.tags;
}

export async function fetchPosts(params: {
  cursor?: string | null;
  limit?: number;
  sort?: "new" | "top";
  tag?: string | null;
  postType?: string | null;
}): Promise<PostListResponse> {
  const query = buildQuery({
    cursor: params.cursor,
    limit: params.limit,
    sort: params.sort,
    tag: params.tag,
    post_type: params.postType,
  });

  const res = await fetchWithAuth(apiUrl(`/api/posts${query}`));
  return parseJson<PostListResponse>(res);
}

export async function fetchPost(postId: number): Promise<PostResponse> {
  const res = await fetchWithAuth(apiUrl(`/api/posts/${postId}`));
  return parseJson<PostResponse>(res);
}

export async function createPost(data: {
  title: string;
  body: string;
  post_type: string;
  tag_ids: number[];
}): Promise<PostResponse> {
  const res = await fetchWithAuth(apiUrl("/api/posts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<PostResponse>(res);
}

export async function updatePost(
  postId: number,
  data: {
    title: string;
    body: string;
    tag_ids: number[];
  },
): Promise<PostResponse> {
  const res = await fetchWithAuth(apiUrl(`/api/posts/${postId}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<PostResponse>(res);
}

export async function deletePost(postId: number): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/posts/${postId}`), {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail =
      typeof err?.detail === "string" ? err.detail : "Request failed";
    throw new Error(detail);
  }
}

export async function togglePin(postId: number): Promise<{ is_pinned: boolean }> {
  const res = await fetchWithAuth(apiUrl(`/api/posts/${postId}/pin`), {
    method: "POST",
  });
  return parseJson<{ is_pinned: boolean }>(res);
}

export async function toggleLock(
  postId: number,
): Promise<{ is_locked: boolean }> {
  const res = await fetchWithAuth(apiUrl(`/api/posts/${postId}/lock`), {
    method: "POST",
  });
  return parseJson<{ is_locked: boolean }>(res);
}

export async function fetchComments(params: {
  postId: number;
  cursor?: string | null;
  limit?: number;
}): Promise<CommentListResponse> {
  const query = buildQuery({
    cursor: params.cursor,
    limit: params.limit,
  });
  const res = await fetchWithAuth(
    apiUrl(`/api/posts/${params.postId}/comments${query}`),
  );
  return parseJson<CommentListResponse>(res);
}

export async function createComment(data: {
  postId: number;
  body: string;
  parent_comment_id?: number | null;
}): Promise<CommentResponse> {
  const res = await fetchWithAuth(apiUrl(`/api/posts/${data.postId}/comments`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      body: data.body,
      parent_comment_id: data.parent_comment_id ?? null,
    }),
  });
  return parseJson<CommentResponse>(res);
}

export async function votePost(
  postId: number,
): Promise<{ voted: boolean; new_count: number }> {
  const res = await fetchWithAuth(apiUrl(`/api/posts/${postId}/vote`), {
    method: "POST",
  });
  return parseJson<{ voted: boolean; new_count: number }>(res);
}

export async function voteComment(
  commentId: number,
): Promise<{ voted: boolean; new_count: number }> {
  const res = await fetchWithAuth(apiUrl(`/api/posts/comments/${commentId}/vote`), {
    method: "POST",
  });
  return parseJson<{ voted: boolean; new_count: number }>(res);
}
