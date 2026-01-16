import { redirect } from "next/navigation";
import { apiUrl, apiHeaders } from "@/lib/api";

async function getLatestSeason(): Promise<number> {
  const res = await fetch(apiUrl("/api/results/seasons"), {
    cache: "no-store",
    headers: apiHeaders(),
  });

  if (!res.ok) {
    // Fallback to 2025 if API fails
    return 2025;
  }

  const seasons: number[] = await res.json();
  // Return the highest season number (API returns in descending order, so first element is newest)
  return Math.max(...seasons);
}

export default async function ResultsPage() {
  const latestSeason = await getLatestSeason();
  redirect(`/results/${latestSeason}`);
}
