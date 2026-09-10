"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SprintRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const season = params.season as string;
  const round = params.round as string;

  useEffect(() => {
    router.replace(`/results/${season}/${round}?tab=sprint`);
  }, [season, round, router]);

  return (
    <main className="min-h-screen bg-surface-band p-8">
      <div className="max-w-6xl mx-auto">
        <p className="text-center text-ink-faint font-mono tracking-widest text-xs uppercase">
          Redirecting to race weekend...
        </p>
      </div>
    </main>
  );
}
