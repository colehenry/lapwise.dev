// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DailyGameDriverSearch from "./DailyGameDriverSearch";

const catalog = [
  {
    driver_slug: "lewis-hamilton",
    full_name: "Lewis Hamilton",
    driver_code: "HAM",
    headshot_url: null,
    race_entries: 350,
  },
  {
    driver_slug: "jackie-lewis",
    full_name: "Jackie Lewis",
    driver_code: null,
    headshot_url: null,
    race_entries: 9,
  },
];

describe("DailyGameDriverSearch", () => {
  it("searches names and codes, supports keyboard selection, and excludes guesses", () => {
    const select = vi.fn();
    render(
      <DailyGameDriverSearch
        catalog={catalog}
        excluded={new Set(["jackie-lewis"])}
        onSelect={select}
      />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "ham" } });
    expect(screen.getByText("Lewis Hamilton")).toBeTruthy();
    expect(screen.queryByText("Jackie Lewis")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(select).toHaveBeenCalledWith(catalog[0]);
  });
});
