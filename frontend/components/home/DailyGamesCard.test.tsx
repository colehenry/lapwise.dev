// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DailyGameSummaryItem } from "@/lib/queries/dailyGames";
import DailyGamesCard from "./DailyGamesCard";

const grid: DailyGameSummaryItem = {
  game: "grid",
  name: "Daily Grid",
  href: "/daily",
  state: "in_progress",
  progress: 4,
  total: 9,
  puzzle_number: 41,
  published_on: "2026-09-10",
};

const guess: DailyGameSummaryItem = {
  game: "guess",
  name: "Guess the Driver",
  href: "/guess",
  state: "not_started",
  progress: 0,
  total: 10,
  puzzle_number: 12,
  published_on: "2026-09-10",
};

describe("DailyGamesCard", () => {
  it("draws today's board state into each tile", () => {
    const { container } = render(
      <DailyGamesCard state="ready" summary={{ games: [grid, guess] }} />,
    );

    expect(
      screen.getByRole("link", { name: /Daily Grid/ }).getAttribute("href"),
    ).toBe("/daily");
    expect(screen.getByText("#41 · 4 of 9 solved")).toBeTruthy();
    expect(container.querySelectorAll(".game-tile__cell--open")).toHaveLength(
      5,
    );
    expect(screen.getByText("Continue →")).toBeTruthy();

    expect(screen.getByText("#12 · Not started")).toBeTruthy();
    expect(screen.getByTitle("10 guesses remaining")).toBeTruthy();
    expect(screen.getByText("Play →")).toBeTruthy();
  });

  it("shows a solved clue row once the driver game is complete", () => {
    const { container } = render(
      <DailyGamesCard
        state="ready"
        summary={{
          games: [{ ...guess, state: "complete", progress: 3 }],
        }}
      />,
    );

    expect(container.querySelectorAll(".game-tile__clue--exact")).toHaveLength(
      5,
    );
    expect(screen.getByText("See result →")).toBeTruthy();
  });
});
