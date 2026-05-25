"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import {
  adminDeletePost,
  adminRestorePost,
  fetchAdminPosts,
} from "@/lib/admin";
import type { AdminPostListItem } from "@/lib/types";

type StatusFilter = "all" | "active" | "removed";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "removed", label: "Removed" },
];

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<AdminPostListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);

  const [confirmState, setConfirmState] = useState<{
    type: "remove" | "restore" | null;
    postId: number | null;
    postTitle: string;
  }>({ type: null, postId: null, postTitle: "" });

  const loadPosts = useCallback(
    async (p = page, q = query, s = statusFilter) => {
      setLoading(true);
      try {
        const data = await fetchAdminPosts(p, 20, q || undefined, s);
        setPosts(data.posts);
        setTotal(data.total);
        setPage(data.page);
      } finally {
        setLoading(false);
      }
    },
    [page, query, statusFilter],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPosts(1, query, statusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, statusFilter, loadPosts]);

  const handleConfirm = async () => {
    if (!confirmState.type || confirmState.postId === null) return;
    try {
      if (confirmState.type === "remove") {
        await adminDeletePost(confirmState.postId);
      } else {
        await adminRestorePost(confirmState.postId);
      }
      loadPosts();
    } finally {
      setConfirmState({ type: null, postId: null, postTitle: "" });
    }
  };

  const pageCount = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-purple-500 rounded-full" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Post Moderation
            </h1>
            <p className="text-sm text-text-muted">
              Hide, restore, pin, and lock discussion posts.
            </p>
          </div>
        </div>
        <div className="w-full md:w-72">
          <Input
            placeholder="Search posts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-bg-tertiary"
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 bg-bg-secondary border border-border-primary rounded-sm p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${
              statusFilter === tab.value
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                : "text-text-muted hover:text-text-primary border border-transparent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card padding="none" className="border-border-primary overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-primary bg-bg-secondary">
                {["Post", "Author", "Status", "Date", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
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
                : posts.map((post) => (
                    <tr
                      key={post.id}
                      className={`text-sm transition-colors ${
                        post.deleted_at
                          ? "bg-red-500/5 hover:bg-red-500/10"
                          : "hover:bg-bg-secondary/50"
                      }`}
                    >
                      <td className="px-5 py-4 max-w-xs">
                        <div className="flex flex-col gap-1">
                          <Link
                            href={`/discussions/${post.id}`}
                            target="_blank"
                            className="font-medium text-text-primary hover:text-purple-300 transition-colors line-clamp-2"
                          >
                            {post.title}
                          </Link>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/posts/${post.id}`}
                              className="text-[10px] font-mono text-text-muted hover:text-purple-300 transition-colors"
                            >
                              {post.comment_count} comments →
                            </Link>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-text-secondary text-xs font-mono">
                        {post.author.username}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {post.deleted_at ? (
                            <Badge variant="red" size="sm">
                              Removed
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm">
                              Active
                            </Badge>
                          )}
                          {post.is_pinned && (
                            <Badge variant="purple" size="sm">
                              Pinned
                            </Badge>
                          )}
                          {post.is_locked && (
                            <Badge variant="neutral" size="sm">
                              Locked
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-text-muted text-xs font-mono whitespace-nowrap">
                        {format(new Date(post.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 justify-end">
                          {post.deleted_at ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() =>
                                setConfirmState({
                                  type: "restore",
                                  postId: post.id,
                                  postTitle: post.title,
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
                                  postId: post.id,
                                  postTitle: post.title,
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
              {!loading && posts.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-text-muted italic"
                  >
                    No posts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {total > 20 && (
        <div className="flex justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 1}
            onClick={() => loadPosts(page - 1)}
          >
            Previous
          </Button>
          <div className="flex items-center px-4 text-sm font-bold text-text-muted font-mono">
            Page {page} of {pageCount}
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => loadPosts(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmState.type === "remove"}
        title="Remove Post"
        message={`Remove "${confirmState.postTitle}"? It will be hidden from public view but can be restored.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={() =>
          setConfirmState({ type: null, postId: null, postTitle: "" })
        }
      />
      <ConfirmDialog
        open={confirmState.type === "restore"}
        title="Restore Post"
        message={`Restore "${confirmState.postTitle}"? It will be visible to all users again.`}
        confirmLabel="Restore"
        variant="primary"
        onConfirm={handleConfirm}
        onCancel={() =>
          setConfirmState({ type: null, postId: null, postTitle: "" })
        }
      />
    </div>
  );
}
