// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DailyGameUtilityBar from "./DailyGameUtilityBar";

describe("DailyGameUtilityBar", () => {
  it("keeps one anchored menu open and closes it with Escape", () => {
    render(
      <DailyGameUtilityBar
        settings={<p>Settings body</p>}
        statistics={<p>Statistics body</p>}
        help={<p>Help body</p>}
      />,
    );
    const help = screen.getByRole("button", { name: "Help" });
    fireEvent.click(help);
    expect(screen.getByText("Help body")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.queryByText("Help body")).toBeNull();
    expect(screen.getByText("Settings body")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Settings body")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Settings" }),
    );
  });

  it("uses the approved control order and closes on an outside pointer", () => {
    render(
      <DailyGameUtilityBar
        settings={<p>Settings body</p>}
        statistics={<p>Statistics body</p>}
        help={<p>Help body</p>}
      />,
    );
    expect(
      screen
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Settings", "Statistics and leaderboard", "Help"]);
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("Help body")).toBeNull();
  });
});
