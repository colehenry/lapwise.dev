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

function replayWithVscPitTrap(): ConsoleReplay {
  const baseCar = consoleReplay.cars[0];
  const starts = Array.from({ length: 18 }, (_, index) => 3500 + index * 100);
  const car = (
    driverCode: string,
    fullName: string,
    finalPosition: number,
    positions: number[],
    offset: number,
  ) => ({
    ...baseCar,
    driver_code: driverCode,
    full_name: fullName,
    final_position: finalPosition,
    start: starts.map((start) => start + offset),
    laps: positions.map((position, index) => ({
      ...baseCar.laps[0],
      pos: position,
      pit: driverCode === "NOR" && index === 15 ? 1 : 0,
    })),
  });

  return {
    ...consoleReplay,
    event_name: "Spanish Grand Prix",
    total_laps: 18,
    status: [
      { from: 4897.6, to: 4975, code: "vsc", label: "VSC deployed" },
      { from: 4975, to: 4986.2, code: "vsc", label: "VSC ending" },
    ],
    cars: [
      car(
        "ANT",
        "Kimi Antonelli",
        1,
        Array.from({ length: 18 }, (_, index) => (index < 15 ? 2 : 1)),
        5,
      ),
      car(
        "VER",
        "Max Verstappen",
        2,
        Array.from({ length: 18 }, (_, index) => (index < 15 ? 3 : 2)),
        10,
      ),
      car(
        "NOR",
        "Lando Norris",
        3,
        Array.from({ length: 18 }, (_, index) =>
          index < 15 ? 1 : index === 15 ? 5 : index === 16 ? 4 : 3,
        ),
        0,
      ),
    ],
    feed: [
      {
        t: 4910,
        lap: 15,
        kind: "pit",
        text: "ANT pits",
        driver_code: "ANT",
      },
      {
        t: 4920,
        lap: 15,
        kind: "pit",
        text: "VER pits",
        driver_code: "VER",
      },
      {
        t: 5000,
        lap: 16,
        kind: "pit",
        text: "NOR pits",
        driver_code: "NOR",
      },
    ],
  };
}

describe("ClutchAsk", () => {
  it("explains when a badly timed VSC turns the leader's race", () => {
    render(<ClutchAsk replay={replayWithVscPitTrap()} />);

    expect(
      screen.getByText("How did the VSC cost Norris the lead?"),
    ).toBeTruthy();
    expect(screen.getByText(/VSC began 2.4 seconds before/)).toBeTruthy();
    expect(
      screen.getByText(/started lap 15—too late to pit immediately/),
    ).toBeTruthy();
    expect(screen.getByText("Antonelli")).toBeTruthy();
    expect(screen.getByText("Verstappen")).toBeTruthy();
    expect(
      screen.getByText(/pitted 13.8 seconds after green-flag racing resumed/),
    ).toBeTruthy();
    expect(
      screen.getByText(/dropping from P1 to P5 before recovering to P3/),
    ).toBeTruthy();
  });

  it("explains the winner's decisive lead rather than the fastest lap", () => {
    render(<ClutchAsk replay={replayWithLateWinningLead()} />);

    expect(
      screen.getByText("When did Verstappen take the lead for good?"),
    ).toBeTruthy();
    expect(screen.getByText(/final time on lap 3/)).toBeTruthy();
    expect(screen.getByText(/last 2 laps/)).toBeTruthy();
    expect(screen.getByText(/Verstappen led 2 of 4 laps overall/)).toBeTruthy();
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
