import { describe, expect, it } from "vitest";
import { createResponseCacheHash } from "./response-cache-key";

describe("response cache keys", () => {
  it("normalizes equivalent questions and includes the cache version", () => {
    expect(createResponseCacheHash("  WHO WON MONACO? ")).toBe(
      createResponseCacheHash("who won monaco?"),
    );
    expect(createResponseCacheHash("who won monaco?")).toHaveLength(64);
  });
});
