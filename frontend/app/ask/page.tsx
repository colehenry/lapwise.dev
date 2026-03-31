import { Suspense } from "react";
import AskContent from "./AskContent";

export const metadata = {
  title: "Ask AI — Lapwise",
  description: "Ask questions about Formula 1 and get AI-powered answers.",
};

export default function AskPage() {
  return (
    <Suspense>
      <AskContent />
    </Suspense>
  );
}
