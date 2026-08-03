"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import Skeleton from "@/components/ui/Skeleton";

/**
 * OAuth landing page. After Google → backend → here, the backend has already
 * set the refresh cookie. AuthProvider runs silentRefresh() on mount as part
 * of its normal boot, so all this page has to do is wait for that to settle
 * and then route the user to ?next=... (or `/`).
 */
export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackPending />}>
      <Callback />
    </Suspense>
  );
}

function Callback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();

  const next = searchParams.get("next") || "/";

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace(next);
    }
  }, [isAuthenticated, isLoading, next, router]);

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-bold text-text-primary mb-2">
            Sign-in didn&apos;t complete
          </h1>
          <p className="text-text-muted text-sm mb-6">
            We couldn&apos;t finish signing you in. Please try again.
          </p>
          <Link
            href="/login"
            className="text-purple-400 hover:text-purple-300 transition-colors text-sm"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return <CallbackPending />;
}

function CallbackPending() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold text-text-primary mb-2">
          Signing you in…
        </h1>
        <p className="text-text-muted text-sm mb-6">
          Just a moment while we set up your session.
        </p>
        <Skeleton className="h-2 w-full" />
      </div>
    </div>
  );
}
