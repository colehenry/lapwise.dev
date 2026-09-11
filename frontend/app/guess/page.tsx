import type { Metadata } from "next";
import GuessGame from "./GuessGame";

export const metadata: Metadata = {
  title: "Who's on Pole? | Lapwise",
  description: "Identify today's Formula 1 driver from five career clues.",
};

export default async function GuessPage({
  searchParams,
}: {
  searchParams: Promise<{ guess?: string }>;
}) {
  const requested = Number.parseInt((await searchParams).guess ?? "", 10);
  const puzzleNumber =
    Number.isInteger(requested) && requested >= 1 ? requested : undefined;
  return <GuessGame puzzleNumber={puzzleNumber} />;
}
