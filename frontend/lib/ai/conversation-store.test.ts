import { describe, expect, it } from "vitest";
import {
  boundConversationHistory,
  buildConversationTitle,
} from "./conversation-store";

describe("conversation context", () => {
  it("keeps the newest messages within the character budget", () => {
    const history = boundConversationHistory(
      [
        { role: "user", content: "old question" },
        { role: "assistant", content: "old answer" },
        { role: "user", content: "new question" },
      ],
      20,
    );

    expect(history).toEqual([
      { role: "assistant", content: "old answ" },
      { role: "user", content: "new question" },
    ]);
    expect(
      history.reduce((total, message) => total + message.content.length, 0),
    ).toBeLessThanOrEqual(20);
  });

  it("creates a concise title without changing short questions", () => {
    expect(buildConversationTitle("Who won Monaco in 2024?")).toBe(
      "Who won Monaco in 2024?",
    );
    expect(
      buildConversationTitle(
        "Can you please compare the complete qualifying performance of Lando Norris and Oscar Piastri across the whole 2025 Formula One season?",
      ).length,
    ).toBeLessThanOrEqual(80);
  });
});
