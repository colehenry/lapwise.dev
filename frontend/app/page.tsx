import type { Metadata } from "next";
import HomeConsole from "@/components/home/HomeConsole";

export const metadata: Metadata = {
  title: "Lapwise — Formula 1 data, replay and analysis",
  description:
    "The last race replayed lap by lap from the record, today's Daily Grid, the championship as it stands, and every result back to 1950.",
};

export default function Home() {
  return <HomeConsole />;
}
