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

  it("shows friendly progress only while the answer is being prepared", () => {
    const steps = [
      {
        message: "Warming up the tyres...",
        stepType: "thinking" as const,
        timestamp: 1000,
      },
      {
        message: "Checking the timing sheets...",
        stepType: "thinking" as const,
        timestamp: 2000,
      },
    ];
    const { rerender } = render(
      <ChatMessage
        messageRole="assistant"
        content="Answer"
        steps={steps}
        isStreaming
      />,
    );
    expect(screen.getByText("Checking the timing sheets...")).toBeTruthy();
    expect(screen.queryByText("Warming up the tyres...")).toBeNull();

    rerender(
      <ChatMessage
        messageRole="assistant"
        content="Answer"
        steps={steps}
        isStreaming={false}
      />,
    );

    expect(screen.queryByText("Checking the timing sheets...")).toBeNull();
    expect(screen.queryByRole("button", { name: /steps/i })).toBeNull();
  });
});
