import { describe, expect, it } from "vitest";
import {
  headlineSegments,
  selectHeadlines,
  tickerCopy,
  tickerSeed,
} from "./homeTicker";
import type { Headline } from "./queries/headlines";

function headline(
  id: string,
  category: string,
  weight = 0.5,
  text = "Something true",
): Headline {
  return {
    id,
    category,
    kicker: "Kicker",
    text,
    tokens: [],
    weight,
    valid_until: { kind: "next_race", date: null },
    href: null,
  };
}

const POOL: Headline[] = [
  headline("championship.driver_gap.2026", "championship", 1),
  headline("last_race.fastest_lap.2026.13", "last_race", 0.9),
  headline("next_race.up_next.2026-09-13", "next_race", 1),
  headline("c1", "championship", 1),
  headline("c2", "championship", 1),
  headline("s1", "streak"),
  headline("s2", "streak"),
  headline("s3", "streak"),
  headline("r1", "records"),
  headline("q1", "qualifying"),
  headline("l1", "last_race"),
  headline("n1", "next_race", 1),
];

describe("selectHeadlines", () => {
  it("opens with the championship and closes with the next race", () => {
    const lane = selectHeadlines(POOL, "2026-09-09");
    expect(lane[0].category).toBe("championship");
    expect(lane[lane.length - 1].category).toBe("next_race");
  });

  it("takes at most one headline per category", () => {
    const lane = selectHeadlines(POOL, "2026-09-09");
    const categories = lane.map((item) => item.category);
    expect(new Set(categories).size).toBe(categories.length);
  });

  it("is stable for a seed, so the lane never jumps on a re-render", () => {
    const a = selectHeadlines(POOL, "2026-09-09").map((item) => item.id);
    const b = selectHeadlines(POOL, "2026-09-09").map((item) => item.id);
    expect(a).toEqual(b);
  });

  it("orders differently on a different day", () => {
    const a = selectHeadlines(POOL, "2026-09-09").map((item) => item.id);
    const b = selectHeadlines(POOL, "2026-09-10").map((item) => item.id);
    expect(a).not.toEqual(b);
  });

  it("honours the target count", () => {
    expect(selectHeadlines(POOL, "2026-09-09", 4)).toHaveLength(4);
  });

  it("renders an empty pool as an empty lane rather than throwing", () => {
    expect(selectHeadlines([], "2026-09-09")).toEqual([]);
  });

  it("still runs when a pinned category is missing", () => {
    const lane = selectHeadlines(
      POOL.filter((item) => item.category !== "next_race"),
      "2026-09-09",
    );
    expect(lane.length).toBeGreaterThan(0);
    expect(lane.some((item) => item.category === "next_race")).toBe(false);
  });
});

describe("tickerSeed", () => {
  it("changes at the 07:00 UTC rollover, matching the daily board", () => {
    expect(tickerSeed(new Date("2026-09-09T06:59:00Z"))).toBe("2026-09-08");
    expect(tickerSeed(new Date("2026-09-09T07:01:00Z"))).toBe("2026-09-09");
  });
});

describe("headlineSegments", () => {
  it("splits a headline on its entity tokens", () => {
    const item: Headline = {
      ...headline("x", "championship"),
      text: "Antonelli leads Russell by 66 points",
      tokens: [
        { start: 0, end: 9, kind: "driver", code: "ANT" },
        { start: 16, end: 23, kind: "driver", code: "RUS" },
      ],
    };
    expect(headlineSegments(item)).toEqual([
      { text: "Antonelli", code: "ANT" },
      { text: " leads ", code: null },
      { text: "Russell", code: "RUS" },
      { text: " by 66 points", code: null },
    ]);
  });

  it("returns the whole text when there is nothing to tint", () => {
    expect(headlineSegments(headline("x", "records"))).toEqual([
      { text: "Something true", code: null },
    ]);
  });

  it("ignores a token that runs past the end of the text", () => {
    const item: Headline = {
      ...headline("x", "records", 0.5, "Short"),
      tokens: [{ start: 0, end: 99, kind: "driver", code: "ANT" }],
    };
    expect(headlineSegments(item)).toEqual([{ text: "Short", code: null }]);
  });
});

describe("what the lane says", () => {
  it("drops the fastest lap, which the race panel already reports", () => {
    const lane = selectHeadlines(POOL, "2026-09-09");
    expect(
      lane.some((item) => item.id.startsWith("last_race.fastest_lap")),
    ).toBe(false);
  });

  it("still carries the rest of the last-race category", () => {
    const pool = [
      headline("last_race.fastest_lap.2026.13", "last_race"),
      headline("last_race.win_margin.2026.13", "last_race"),
    ];
    const lane = selectHeadlines(pool, "2026-09-09");
    expect(lane.map((item) => item.id)).toEqual([
      "last_race.win_margin.2026.13",
    ]);
  });

  it("words the championship gap and the next race the lane's way", () => {
    // One candidate per pinned category, so the weighted pick cannot choose
    // the other one and make this assert about nothing.
    const lane = selectHeadlines(
      [
        headline("championship.driver_gap.2026", "championship", 1),
        headline("next_race.up_next.2026-09-13", "next_race", 1),
      ],
      "2026-09-09",
    );
    expect(lane[0].kicker).toBe("Championship gap");
    expect(lane[1].kicker).toBe("Next race");
  });

  it("leaves a kicker it has no opinion about alone", () => {
    expect(tickerCopy(headline("streak.wins.ANT", "streak")).kicker).toBe(
      "Kicker",
    );
  });
});
