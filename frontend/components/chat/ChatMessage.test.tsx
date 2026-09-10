// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChatMessage from "./ChatMessage";

vi.mock("@/hooks/useEntityLinkColors", () => ({
  useEntityLinkColors: () => ({
    driverColors: new Map(),
    teamColors: new Map(),
  }),
}));

describe("ChatMessage", () => {
  it("keeps the same assistant region from loading through streamed text", () => {
    const { rerender } = render(
      <ChatMessage
        messageRole="assistant"
        content=""
        isLoading
        isStreaming
        progressStatus={{ stage: "starting" }}
      />,
    );
    const loadingRegion = screen.getByRole("article", {
      name: "Clutch response",
    });

    rerender(
      <ChatMessage
        messageRole="assistant"
        content="The answer is streaming."
        isLoading={false}
        isStreaming
      />,
    );

    expect(screen.getByRole("article", { name: "Clutch response" })).toBe(
      loadingRegion,
    );
    expect(screen.getByText("The answer is streaming.")).toBeTruthy();
  });

  it("shows friendly progress only while the answer is being prepared", () => {
    const { rerender } = render(
      <ChatMessage
        messageRole="assistant"
        content="Answer"
        isStreaming
        progressStatus={{
          stage: "more_data",
          metrics: [{ value: 84, label: "records checked" }],
        }}
      />,
    );
    expect(screen.getByText("84 records checked")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();

    rerender(
      <ChatMessage
        messageRole="assistant"
        content="Answer"
        isStreaming={false}
        progressStatus={{ stage: "more_data" }}
      />,
    );

    expect(screen.queryByRole("status")).toBeNull();
  });
});
