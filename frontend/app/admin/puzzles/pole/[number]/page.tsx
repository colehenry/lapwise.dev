"use client";

import { useParams } from "next/navigation";
import GuessPreview from "../../GuessPreview";

export default function AdminPolePage() {
  const { number } = useParams<{ number: string }>();
  return <GuessPreview key={number} number={Number(number)} />;
}
