// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DailyGameLights from "./DailyGameLights";

describe("DailyGameLights", () => {
  it("renders ten lights as two rows of five with the spent count", () => {
    const { container } = render(<DailyGameLights spent={3} total={10} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "3 of 10 guesses used",
    );
    expect(container.querySelectorAll("i")).toHaveLength(10);
    expect(container.querySelectorAll(".bg-danger")).toHaveLength(3);
    expect(screen.getByRole("img").getAttribute("style")).toContain(
      "repeat(5, 8px)",
    );
  });
});
