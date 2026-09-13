import { describe, expect, it } from "vitest";
import { splitF1GlossaryText } from "./f1Glossary";

describe("F1 glossary", () => {
  it("defines specialist terms without changing the displayed copy", () => {
    const fragments = splitF1GlossaryText(
      "Lawson covered the undercut during the VSC.",
    );

    expect(fragments.map((fragment) => fragment.text).join("")).toBe(
      "Lawson covered the undercut during the VSC.",
    );
    expect(
      fragments
        .filter((fragment) => fragment.definition)
        .map(({ term }) => term),
    ).toEqual(["undercut", "vsc"]);
  });

  it("matches Virtual Safety Car as one term", () => {
    const defined = splitF1GlossaryText(
      "A Virtual Safety Car changed the race.",
    )
      .filter((fragment) => fragment.definition)
      .map(({ term }) => term);

    expect(defined).toEqual(["virtual safety car"]);
  });
});
