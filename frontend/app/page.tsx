import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import HomeConsole from "@/components/home/HomeConsole";
import { prefetchHomeForHydration } from "@/lib/queries/homePrefetch";

// Share only public HTML. A single page cache avoids independently aging API
// responses being stamped fresh in a newly generated hydration snapshot.
export const dynamic = "force-static";
// Next requires a literal revalidation interval here.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Lapwise — Formula 1 data, replay and analysis",
  description:
    "The last race replayed lap by lap from the record, today's Daily Games, the championship as it stands, and every result back to 1950.",
};

export default async function Home() {
  const state = await prefetchHomeForHydration();
  return (
    <HydrationBoundary state={state}>
      <HomeConsole />
    </HydrationBoundary>
  );
}
