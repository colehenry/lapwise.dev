import type { Metadata } from "next";
import GuessGame from "./GuessGame";

export const metadata: Metadata = {
  title: "Who's on Pole? | Lapwise",
  description: "Identify today's Formula 1 driver from five career clues.",
};

export default function GuessPage() {
  return <GuessGame />;
}
