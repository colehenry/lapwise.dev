import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import DailyGameGrid from "./DailyGameGrid";

export const metadata: Metadata = {
  title: "Daily Grid | Lapwise",
  description:
    "Find the Formula 1 driver who connects each pair of categories in the Lapwise Daily Grid.",
};

export default async function DailyGridPage({
  searchParams,
}: {
  searchParams: Promise<{ grid?: string }>;
}) {
  const requestedGrid = Number.parseInt((await searchParams).grid ?? "", 10);
  const puzzleNumber =
    Number.isInteger(requestedGrid) && requestedGrid >= 1 && requestedGrid <= 5
      ? requestedGrid
      : undefined;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-bg-primary">
      <Container className="py-4 sm:py-6">
        <DailyGameGrid puzzleNumber={puzzleNumber} />
      </Container>
    </div>
  );
}
