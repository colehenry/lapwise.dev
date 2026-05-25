"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import PostEditor from "@/components/discussions/PostEditor";
import { GridPattern } from "@/components/Patterns";
import { createPost } from "@/lib/discussions";

export default function NewDiscussionPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login?redirect=/discussions/new");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return null;

  const handleSubmit = async (data: {
    title: string;
    body: string;
    post_type: string;
    tag_ids: number[];
  }) => {
    const post = await createPost(data);
    router.push(`/discussions/${post.id}`);
  };

  return (
    <div className="min-h-screen bg-bg-secondary">
      <div className="relative overflow-hidden border-b border-border-primary">
        <GridPattern
          id="new-post-grid"
          className="absolute inset-0 w-full h-full text-purple-500 opacity-[0.06] pointer-events-none"
        />
        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span className="text-[10px] tracking-widest text-text-muted font-bold uppercase font-mono">
              Create Post
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight">
            Start a Discussion
          </h1>
          <p className="text-text-tertiary mt-3">
            Bring your race observations to the community.{" "}
            <Link
              href="/rules"
              className="text-purple-400 hover:text-purple-300 underline underline-offset-2 text-sm"
            >
              Community rules
            </Link>
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <PostEditor onSubmit={handleSubmit} submitLabel="Publish post" />
      </div>
    </div>
  );
}
