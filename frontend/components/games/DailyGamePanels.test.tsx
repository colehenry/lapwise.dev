// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DailyGameSettingsPanel from "./DailyGameSettingsPanel";
import DailyGameStatsPanel from "./DailyGameStatsPanel";

describe("Daily Games utility panels", () => {
  it("updates the shared accessibility settings", () => {
    const onChange = vi.fn();
    render(
      <DailyGameSettingsPanel
        settings={{ highContrast: false, reduceMotion: false }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /high-contrast/i }));
    expect(onChange).toHaveBeenCalledWith({
      highContrast: true,
      reduceMotion: false,
    });
  });

  it("keeps an honest empty state while still showing a real leaderboard", () => {
    render(
      <DailyGameStatsPanel
        loading={false}
        maxScore={10}
        stats={{
          played: 0,
          won: 0,
          win_percentage: 0,
          current_streak: 0,
          max_streak: 0,
          distribution: {},
          aggregate_distribution: null,
        }}
        leaderboard={{
          entries: [
            {
              rank: 1,
              display_name: "lapwise-player",
              won: true,
              score: 2,
              elapsed_ms: 1200,
            },
          ],
          total: 1,
          offset: 0,
          limit: 20,
        }}
      />,
    );
    expect(screen.getByText(/complete a game/i)).toBeTruthy();
    expect(screen.getByText("lapwise-player")).toBeTruthy();
    expect(screen.getAllByText("0").length).toBeGreaterThan(1);
  });
});
