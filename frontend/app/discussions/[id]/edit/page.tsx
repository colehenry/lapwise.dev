"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import PostEditor from "@/components/discussions/PostEditor";
import { GridPattern } from "@/components/Patterns";
import { fetchPost, updatePost } from "@/lib/discussions";
import type { PostResponse } from "@/lib/types";

export default function EditDiscussionPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const postId = Number(params.id);

  const { data: post, isLoading: postLoading } = useQuery<PostResponse>({
    queryKey: ["discussion-post", postId],
    queryFn: () => fetchPost(postId),
    enabled: Number.isFinite(postId),
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/login?redirect=/discussions/${postId}/edit`);
    }
  }, [authLoading, isAuthenticated, postId, router]);

  useEffect(() => {
    if (!post || authLoading) return;
    const isAuthor = user?.id === post.author.id;
    const isAdmin = user?.role === "admin";
    if (!isAuthor && !isAdmin) {
      router.push(`/discussions/${postId}`);
    }
  }, [post, authLoading, postId, router, user]);

  if (postLoading || authLoading || !post) {
    return (
      <div className="min-h-screen bg-bg-secondary flex items-center justify-center text-text-muted font-mono text-xs uppercase tracking-widest">
        Loading editor...
      </div>
    );
  }

  const handleSubmit = async (data: {
    title: string;
    body: string;
    post_type: string;
    tag_ids: number[];
  }) => {
    const updated = await updatePost(postId, {
      title: data.title,
      body: data.body,
      tag_ids: data.tag_ids,
    });
    router.push(`/discussions/${updated.id}`);
  };

  return (
    <div className="min-h-screen bg-bg-secondary">
      <div className="relative overflow-hidden border-b border-border-primary">
        <GridPattern
          id="edit-post-grid"
          className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.06] pointer-events-none"
        />
        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              Edit Post
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">
            Update Your Post
          </h1>
          <p className="text-text-tertiary mt-3">
            Refine your analysis or add new context before publishing.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <PostEditor
          initial={{
            id: post.id,
            title: post.title,
            body: post.body,
            post_type: post.post_type,
            tag_ids: post.tags.map((tag) => tag.id),
          }}
          disablePostType
          onSubmit={handleSubmit}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
