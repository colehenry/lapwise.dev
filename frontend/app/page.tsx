import type { Metadata } from "next";
import HomeConsole from "@/components/home/HomeConsole";

export const metadata: Metadata = {
  title: "Lapwise — F1 Analytics & Telemetry",
  description:
    "Every lap of every Grand Prix since 2018, with race replay, full results back to 1950, and an analyst you can ask in plain English.",
};

export default function Home() {
  return <HomeConsole />;
}
