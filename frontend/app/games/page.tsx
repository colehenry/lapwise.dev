import type { Metadata } from "next";
import DailyGamesHub from "./DailyGamesHub";

export const metadata: Metadata = {
  title: "Daily Games | Lapwise",
  description: "Play today's Lapwise Formula 1 games.",
};

export default function GamesPage() {
  return <DailyGamesHub />;
}
