// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
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
        statusText="Starting analysis..."
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
        statusText={null}
      />,
    );

    expect(screen.getByRole("article", { name: "Clutch response" })).toBe(
      loadingRegion,
    );
    expect(screen.getByText("The answer is streaming.")).toBeTruthy();
  });

  it("keeps completed thinking steps collapsed until the user opens them", () => {
    const steps = [
      { message: "Planning", stepType: "thinking" as const, timestamp: 1000 },
      { message: "Querying", stepType: "sql" as const, timestamp: 2000 },
    ];
    const { rerender } = render(
      <ChatMessage
        messageRole="assistant"
        content="Answer"
        steps={steps}
        isStreaming
      />,
    );

    rerender(
      <ChatMessage
        messageRole="assistant"
        content="Answer"
        steps={steps}
        isStreaming={false}
      />,
    );

    const toggle = screen.getByRole("button", { name: "2 steps · 1.0s" });
    expect(screen.queryByText("Planning")).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText("Planning")).toBeTruthy();
  });
});
