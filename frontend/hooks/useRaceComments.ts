"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createComment,
  deleteComment,
  fetchRaceComments,
} from "@/lib/comments";
import type { CommentResponse, RaceCommentsResponse } from "@/lib/types";

export type CommentSort = "new" | "top";

const EMPTY: RaceCommentsResponse = {
  comments: [],
  next_cursor: null,
  comment_count: 0,
  is_locked: false,
};

function insertComment(
  data: RaceCommentsResponse,
  created: CommentResponse,
  parentId: number | null,
): RaceCommentsResponse {
  const comment_count = data.comment_count + 1;

  if (!parentId) {
    return { ...data, comments: [...data.comments, created], comment_count };
  }

  return {
    ...data,
    comment_count,
    comments: data.comments.map((comment) =>
      comment.id === parentId
        ? { ...comment, replies: [...(comment.replies ?? []), created] }
        : comment,
    ),
  };
}

function removeComment(
  data: RaceCommentsResponse,
  commentId: number,
): RaceCommentsResponse {
  const comments = data.comments
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({
      ...comment,
      replies: (comment.replies ?? []).filter(
        (reply) => reply.id !== commentId,
      ),
    }));

  return {
    ...data,
    comments,
    comment_count: Math.max(0, data.comment_count - 1),
  };
}

/**
 * Race thread data plus the writes against it. Posting and deleting patch the
 * cache with the server's own response so the thread updates on the spot,
 * then revalidate in the background.
 */
export function useRaceComments(
  season: number,
  round: number,
  sort: CommentSort,
) {
  const queryClient = useQueryClient();
  const queryKey = ["race-comments", season, round, sort];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchRaceComments({ season, round, sort }),
  });

  const revalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["race-comments", season, round],
    });
  };

  const patch = (
    update: (current: RaceCommentsResponse) => RaceCommentsResponse,
  ) => {
    queryClient.setQueryData<RaceCommentsResponse>(queryKey, (current) =>
      update(current ?? EMPTY),
    );
    revalidate();
  };

  const addComment = async (body: string, parentId: number | null = null) => {
    const created = await createComment({
      season,
      round,
      body,
      parent_comment_id: parentId,
    });
    patch((current) => insertComment(current, created, parentId));
  };

  const removeCommentById = async (commentId: number) => {
    await deleteComment(commentId);
    patch((current) => removeComment(current, commentId));
  };

  return {
    comments: data?.comments ?? [],
    commentCount: data?.comment_count ?? 0,
    isLocked: data?.is_locked ?? false,
    isLoading,
    addComment,
    removeComment: removeCommentById,
  };
}
