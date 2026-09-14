// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ConsoleReplay } from "@/lib/queries/consoleReplay";
import { consoleReplay } from "@/test/fixtures";
import ClutchAsk from "./ClutchAsk";

function replayWithLateWinningLead(): ConsoleReplay {
  return {
    ...consoleReplay,
    cars: consoleReplay.cars.map((car) => {
      if (car.driver_code === "VER") {
        return {
          ...car,
          laps: car.laps.map((lap, index) => ({
            ...lap,
            pos: index < 2 ? 2 : 1,
          })),
        };
      }
      return {
        ...car,
        laps: car.laps.map((lap, index) => ({
          ...lap,
          pos: index < 2 ? 1 : 2,
        })),
      };
    }),
  };
}

describe("ClutchAsk", () => {
  it("explains the winner's decisive lead rather than the fastest lap", () => {
    render(<ClutchAsk replay={replayWithLateWinningLead()} />);

    expect(
      screen.getByText("When did Verstappen take the lead for good?"),
    ).toBeTruthy();
    expect(screen.getByText(/final time on lap 3/)).toBeTruthy();
    expect(screen.getByText(/last 2 laps/)).toBeTruthy();
    expect(screen.getByText(/led 2 of 4 laps overall/)).toBeTruthy();
    expect(screen.queryByText(/fastest lap/i)).toBeNull();
  });

  it("recognizes a winner who led every recorded lap", () => {
    render(<ClutchAsk replay={consoleReplay} />);

    expect(
      screen.getByText("Did Verstappen lead from start to finish?"),
    ).toBeTruthy();
    expect(screen.getByText(/leading all 4/)).toBeTruthy();
  });
});
