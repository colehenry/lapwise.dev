"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isStoredGridFinished } from "@/hooks/useDailyGridProgress";

function GridLink({
  number,
  direction,
}: {
  number: number;
  direction: "next" | "previous";
}) {
  const puzzleId = `grid-${String(number).padStart(3, "0")}`;
  const [finished, setFinished] = useState(false);
  const arrow = direction === "previous" ? "‹" : "›";

  useEffect(() => {
    setFinished(isStoredGridFinished(puzzleId));
  }, [puzzleId]);

  return (
    <Link
      href={`/daily?grid=${number}`}
      className="text-xs font-semibold text-text-secondary underline decoration-border-secondary underline-offset-4 transition-colors hover:text-text-primary"
    >
      {direction === "previous" && `${arrow} `}
      Grid {String(number).padStart(3, "0")}
      {finished ? " ✓" : ""}
      {direction === "next" && ` ${arrow}`}
    </Link>
  );
}

export default function PuzzleNavigation({
  center,
  nextNumber,
  previousNumber,
}: {
  center?: React.ReactNode;
  nextNumber: number | null;
  previousNumber: number | null;
}) {
  return (
    <nav
      aria-label="Grid navigation"
      className="mt-3 grid grid-cols-3 items-center"
    >
      <div>
        {previousNumber !== null && (
          <GridLink number={previousNumber} direction="previous" />
        )}
      </div>
      <div className="justify-self-center">{center}</div>
      <div className="justify-self-end">
        {nextNumber !== null && (
          <GridLink number={nextNumber} direction="next" />
        )}
      </div>
    </nav>
  );
}
