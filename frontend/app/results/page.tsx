import { redirect } from "next/navigation";
import { apiHeaders, apiUrl } from "@/lib/api";

/** The redirect target depends on live data, so it is resolved per request —
 * but the seasons list itself is cached, which removes the origin round trip
 * from almost every visit. */
export const dynamic = "force-dynamic";

const SEASONS_REVALIDATE_SECONDS = 3600;

async function getLatestSeason(): Promise<number> {
  try {
    const res = await fetch(apiUrl("/api/results/seasons"), {
      next: { revalidate: SEASONS_REVALIDATE_SECONDS },
      headers: apiHeaders(),
    });
    if (!res.ok) return new Date().getFullYear();

    const seasons: number[] = await res.json();
    return seasons.length > 0 ? Math.max(...seasons) : new Date().getFullYear();
  } catch {
    return new Date().getFullYear();
  }
}

export default async function ResultsPage() {
  const latestSeason = await getLatestSeason();
  redirect(`/results/${latestSeason}`);
}
