"use client";

import { Suspense } from "react";
import RoundContent from "./RoundContent";

export default function RoundDetailPage() {
  return (
    <Suspense>
      <RoundContent />
    </Suspense>
  );
}
