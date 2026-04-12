import { Suspense } from "react";
import AskContent from "./AskContent";

export const metadata = {
  title: "Ask Clutch — Lapwise",
  description:
    "Ask Clutch any question about Formula 1 and get AI-powered answers.",
};

export default function AskPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-secondary flex items-center justify-center">
          <span className="text-text-muted text-sm font-mono">Loading...</span>
        </div>
      }
    >
      <AskContent />
    </Suspense>
  );
}
