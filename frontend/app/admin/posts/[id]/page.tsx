"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  adminDeleteComment,
  adminRestoreComment,
  fetchAdminPostComments,
} from "@/lib/admin";
import type { AdminCommentListItem } from "@/lib/types";

export default function AdminPostCommentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const postId = Number(id);

  const [comments, setComments] = useState<AdminCommentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [confirmState, setConfirmState] = useState<{
    type: "remove" | "restore" | null;
    commentId: number | null;
  }>({ type: null, commentId: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminPostComments(postId);
      setComments(data);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirm = async () => {
    if (!confirmState.type || confirmState.commentId === null) return;
    try {
      if (confirmState.type === "remove") {
        await adminDeleteComment(confirmState.commentId);
      } else {
        await adminRestoreComment(confirmState.commentId);
      }
      load();
    } finally {
      setConfirmState({ type: null, commentId: null });
    }
  };

  const active = comments.filter((c) => !c.deleted_at).length;
  const removed = comments.filter((c) => c.deleted_at).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/posts"
          className="text-text-muted hover:text-purple-300 transition-colors text-sm font-mono"
        >
          ← Posts
        </Link>
        <div className="w-px h-4 bg-border-primary" />
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-purple-500 rounded-full" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Comment Moderation
            </h1>
            <p className="text-sm text-text-muted">
              Post #{postId} &mdash;{" "}
              <Link
                href={`/discussions/${postId}`}
                target="_blank"
                className="hover:text-purple-300 transition-colors"
              >
                View post ↗
              </Link>
            </p>
          </div>
        </div>
      </div>

      {!loading && (
        <div className="flex gap-3">
          <span className="text-xs font-mono text-text-muted">
            {active} active
          </span>
          <span className="text-xs font-mono text-text-muted">•</span>
          <span className="text-xs font-mono text-red-400">
            {removed} removed
          </span>
        </div>
      )}

      <Card padding="none" className="border-border-primary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-primary bg-bg-secondary">
                {["Author", "Comment", "Status", "Posted", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 bg-bg-tertiary rounded-sm animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : comments.map((comment) => (
                    <tr
                      key={comment.id}
                      className={`text-sm transition-colors ${
                        comment.deleted_at
                          ? "bg-red-500/5 hover:bg-red-500/10 opacity-60"
                          : "hover:bg-bg-secondary/50"
                      }`}
                    >
                      <td className="px-5 py-4 text-xs font-mono text-text-secondary whitespace-nowrap">
                        {comment.author.username}
                      </td>
                      <td className="px-5 py-4 max-w-sm">
                        <p className="text-text-secondary text-xs line-clamp-3">
                          {comment.body}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {comment.deleted_at ? (
                          <Badge variant="red" size="sm">
                            Removed
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm">
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-4 text-text-muted text-xs font-mono whitespace-nowrap">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          {comment.deleted_at ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() =>
                                setConfirmState({
                                  type: "restore",
                                  commentId: comment.id,
                                })
                              }
                            >
                              Restore
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="text-xs h-7 text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/50"
                              onClick={() =>
                                setConfirmState({
                                  type: "remove",
                                  commentId: comment.id,
                                })
                              }
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              {!loading && comments.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-text-muted italic"
                  >
                    No comments on this post.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmState.type === "remove"}
        title="Remove Comment"
        message="Remove this comment? It will be hidden from public view but can be restored."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmState({ type: null, commentId: null })}
      />
      <ConfirmDialog
        open={confirmState.type === "restore"}
        title="Restore Comment"
        message="Restore this comment? It will be visible to all users again."
        confirmLabel="Restore"
        variant="primary"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmState({ type: null, commentId: null })}
      />
    </div>
  );
}
