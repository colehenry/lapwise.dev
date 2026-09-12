"use client";

import { useParams } from "next/navigation";
import BoardBuilder from "../../BoardBuilder";

/** `new` builds a board; a number opens one. */
export default function AdminBoardPage() {
  const { number } = useParams<{ number: string }>();
  return (
    <BoardBuilder
      key={number}
      number={number === "new" ? null : Number(number)}
    />
  );
}
