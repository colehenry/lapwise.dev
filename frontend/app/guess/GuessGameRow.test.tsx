// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GuessGameResult } from "@/lib/queries/guessGame";
import GuessGameRow from "./GuessGameRow";

const exact = { state: "exact", direction: null } as const;
const guess: GuessGameResult = {
  sequence: 1,
  correct: true,
  driver: {
    driver_slug: "sebastian-vettel",
    full_name: "Sebastian Vettel",
    driver_code: "VET",
    headshot_url: null,
  },
  values: {
    debut: 2007,
    last_raced: 2022,
    country: "Germany",
    constructor: "Red Bull Racing",
    career_peak: "World Champion",
  },
  comparisons: {
    debut: exact,
    last_raced: exact,
    country: exact,
    constructor: { state: "close", direction: null },
    career_peak: exact,
  },
  fact: {
    id: "career.starts",
    text: "Made 299 Grand Prix starts.",
    constructor_color: "3671C6",
  },
  answer: {
    driver_slug: "sebastian-vettel",
    full_name: "Sebastian Vettel",
    driver_code: "VET",
  },
  highlights: [{ id: "wins", value: "53", label: "Grand Prix wins" }],
};

describe("GuessGameRow", () => {
  it("keeps the approved clue order, tooltip, fact, trophy, and highlights", () => {
    const { container } = render(
      <GuessGameRow guess={guess} highContrast={false} reduceMotion />,
    );
    const labels = [
      ...container.querySelectorAll(".game-clue > span:first-child"),
    ].map((node) => node.textContent);
    expect(labels).toEqual([
      "Debut",
      "Last raced",
      "Country",
      "Constructor",
      "Career peak",
    ]);
    expect(screen.getByLabelText("Correct")).toBeTruthy();
    expect(screen.getByText("Driver Fact")).toBeTruthy();
    expect(screen.getByText("53")).toBeTruthy();
    expect(
      container.querySelector("[data-tooltip^='Yellow means']"),
    ).toBeTruthy();
    expect(container.textContent).not.toContain("Superlatives");
    expect(
      container.querySelectorAll(".grid-cols-\\[14px_auto_14px\\]"),
    ).toHaveLength(2);
    expect(container.querySelector("aside")?.getAttribute("style")).toContain(
      "3671C6",
    );
  });

  it("shows no trophy or tooltip for an ordinary exact row", () => {
    const { container } = render(
      <GuessGameRow
        guess={{
          ...guess,
          correct: false,
          answer: null,
          highlights: null,
          comparisons: { ...guess.comparisons, constructor: exact },
        }}
        highContrast={false}
        reduceMotion
      />,
    );
    expect(screen.queryByLabelText("Correct")).toBeNull();
    expect(container.querySelector("[data-tooltip]")).toBeNull();
  });
});
