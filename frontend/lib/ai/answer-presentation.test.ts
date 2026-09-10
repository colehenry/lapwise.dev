import { describe, expect, it } from "vitest";
import {
  collectEntityReferences,
  presentAgentAnswer,
} from "./answer-presentation";

describe("answer presentation", () => {
  it("collects trusted internal entity links from typed tool output", () => {
    expect(
      collectEntityReferences({
        drivers: [{ name: "Kimi Antonelli", href: "/drivers/antonelli" }],
        ignored: [{ name: "External", href: "https://example.com" }],
      }),
    ).toEqual([{ name: "Kimi Antonelli", href: "/drivers/antonelli" }]);
  });

  it("links the first mention without duplicating existing markdown links", () => {
    const references = [
      { name: "Kimi Antonelli", href: "/drivers/antonelli" },
      { name: "Mercedes", href: "/constructors/mercedes" },
    ];

    expect(
      presentAgentAnswer(
        "  **Kimi Antonelli** leads for Mercedes. Kimi Antonelli is clear.  ",
        references,
      ),
    ).toBe(
      "**[Kimi Antonelli](/drivers/antonelli)** leads for [Mercedes](/constructors/mercedes). Kimi Antonelli is clear.",
    );
    expect(
      presentAgentAnswer(
        "[Kimi Antonelli](/drivers/antonelli) leads.",
        references,
      ),
    ).toBe("[Kimi Antonelli](/drivers/antonelli) leads.");
  });
});
