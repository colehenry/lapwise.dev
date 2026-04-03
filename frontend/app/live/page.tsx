import { Suspense } from "react";
import LivePage from "./LivePage";

export const metadata = {
  title: "Live & Replay — Lapwise",
  description:
    "Watch race replays with animated driver positions on track maps, or follow live race data during active F1 sessions.",
};

export default function LivePageRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-secondary flex items-center justify-center">
          <span className="text-text-muted text-sm font-mono">Loading...</span>
        </div>
      }
    >
      <LivePage />
    </Suspense>
  );
}
