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
        <div className="page-frame min-h-[calc(100dvh-3.25rem)] py-16">
          <p className="m-0 font-mono text-[12px] text-ink-faint">Loading…</p>
        </div>
      }
    >
      <AskContent />
    </Suspense>
  );
}
