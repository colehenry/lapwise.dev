// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChampionshipClinchMarker from "@/components/charts/ChampionshipClinchMarker";
import ChampionTrophy from "@/components/standings/ChampionTrophy";
import { MedalsWithBreakdown } from "@/components/standings/StandingsPointsDisplay";
import type { DriverStanding } from "@/lib/championshipTypes";
import type { ProgressionChartPoint } from "@/lib/queries/pointsProgression";

// Recharts reads ReferenceDot from a chart's children and never renders it on
// its own, so the marker is called as a function: what matters is whether it
// decides to place a trophy, and at what height.
const marker = (
  props: Parameters<typeof ChampionshipClinchMarker>[0],
): { props: { x: string; y: number } } | null =>
  ChampionshipClinchMarker(props) as { props: { x: string; y: number } } | null;

const CHART: ProgressionChartPoint[] = [
  { round: "18", "kimi-antonelli": 365, "max-verstappen": 242 },
  { round: "19", "kimi-antonelli": 380, "max-verstappen": 261 },
  { round: "20", "kimi-antonelli": 405, "max-verstappen": 280 },
];

describe("the trophy on the championship chart", () => {
  it("sits on the champion's line at the round they clinched", () => {
    const placed = marker({
      clinchedRound: 19,
      seriesKey: "kimi-antonelli",
      chartData: CHART,
      label: "Antonelli clinched the title at this round",
    });

    expect(placed?.props.x).toBe("19");
    // The champion's own total, not the rival's and not the axis floor.
    expect(placed?.props.y).toBe(380);
  });

  it("stays away when no title has been clinched", () => {
    expect(
      marker({
        clinchedRound: null,
        seriesKey: "kimi-antonelli",
        chartData: CHART,
        label: "",
      }),
    ).toBeNull();
  });

  it("stays away when the champion's series is not on the chart", () => {
    expect(
      marker({
        clinchedRound: 19,
        seriesKey: null,
        chartData: CHART,
        label: "",
      }),
    ).toBeNull();
  });

  it("stays away when the clinching round holds no point for the champion", () => {
    expect(
      marker({
        clinchedRound: 19,
        seriesKey: "kimi-antonelli",
        chartData: [{ round: "19", "max-verstappen": 261 }],
        label: "",
      }),
    ).toBeNull();
  });
});

const standing = (clinched: number | null): DriverStanding =>
  ({
    position: 1,
    full_name: "Andrea Kimi Antonelli",
    team_name: "Mercedes",
    total_points: 380,
    points_scored: 380,
    championship_points: 380,
    classification_status: "provisional",
    clinched_round: clinched,
    wins: 9,
    p2s: 3,
    p3s: 2,
    position_counts: {},
  }) as DriverStanding;

describe("the champion trophy in the standings", () => {
  it("marks the champion and names the round for a reader", () => {
    render(<ChampionTrophy entrant={standing(19)} />);

    const trophy = screen.getByRole("img", { name: /clinched round 19/i });
    expect(trophy.textContent).toBe("🏆");
    expect(trophy.getAttribute("title")).toBe("Clinched R19");
  });

  it("shows nothing for an entrant who has not clinched", () => {
    const { container } = render(<ChampionTrophy entrant={standing(null)} />);

    expect(container.innerHTML).toBe("");
  });
});

describe("the points breakdown on hover", () => {
  const breakdown = (clinchedRound: number | null) =>
    render(
      <MedalsWithBreakdown
        mode="race"
        p1={9}
        p2={3}
        p3={5}
        total={380}
        name="Andrea Kimi Antonelli"
        positionCounts={{ 1: 9, 2: 3 }}
        clinchedRound={clinchedRound}
      />,
    );

  it("opens with the title, above the finishes", () => {
    breakdown(19);

    fireEvent.mouseEnter(screen.getByRole("button", { name: /breakdown/ }));

    const panel = screen.getByText("Champion").parentElement?.parentElement;
    const rows = panel?.textContent ?? "";
    expect(rows).toContain("Champion");
    expect(rows).toContain("Clinched R19");
    // The title comes before the finishing-position counts.
    expect(rows.indexOf("Champion")).toBeLessThan(rows.indexOf("P1"));
  });

  it("omits the title row for an entrant who has not clinched", () => {
    breakdown(null);

    fireEvent.mouseEnter(screen.getByRole("button", { name: /breakdown/ }));

    expect(screen.queryByText("Champion")).toBeNull();
    expect(screen.getByText("P1")).toBeDefined();
  });
});
