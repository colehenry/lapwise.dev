import { Suspense } from "react";
import ReplayPage from "./ReplayPage";

export const metadata = {
  title: "Race Replay — Lapwise",
  description:
    "Watch race replays with animated driver positions on track maps and full telemetry from past F1 sessions.",
};

export default function ReplayPageRoute() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-secondary flex items-center justify-center">
          <span className="text-text-muted text-sm font-mono">Loading...</span>
        </div>
      }
    >
      <ReplayPage />
    </Suspense>
  );
}
