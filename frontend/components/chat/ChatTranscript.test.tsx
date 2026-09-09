// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DisplayMessage } from "@/lib/chatMessages";
import ChatTranscript from "./ChatTranscript";

vi.mock("./ChatMessage", () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock("./SuggestedQuestions", () => ({
  default: () => <div>Suggestions</div>,
}));

function assistantMessage(content: string): DisplayMessage {
  return { id: "assistant", role: "assistant", content };
}

function renderTranscript(messages: DisplayMessage[]) {
  return render(
    <ChatTranscript
      messages={messages}
      error={null}
      streamingAssistantId="assistant"
      streamStatus={null}
      isAsking
      disabled
      userName="driver"
      onSend={vi.fn()}
    />,
  );
}

describe("ChatTranscript", () => {
  it("follows streamed content while the reader remains near the bottom", () => {
    const { rerender } = renderTranscript([assistantMessage("First")]);
    const transcript = screen.getByRole("log");
    Object.defineProperties(transcript, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 300 },
    });
    transcript.scrollTop = 200;

    rerender(
      <ChatTranscript
        messages={[assistantMessage("First and second")]}
        error={null}
        streamingAssistantId="assistant"
        streamStatus={null}
        isAsking
        disabled
        userName="driver"
        onSend={vi.fn()}
      />,
    );

    expect(transcript.scrollTop).toBe(300);
  });

  it("preserves the reader's position after they scroll away from the bottom", () => {
    const { rerender } = renderTranscript([assistantMessage("First")]);
    const transcript = screen.getByRole("log");
    Object.defineProperties(transcript, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 300 },
    });
    transcript.scrollTop = 20;
    fireEvent.scroll(transcript);

    rerender(
      <ChatTranscript
        messages={[assistantMessage("First and second")]}
        error={null}
        streamingAssistantId="assistant"
        streamStatus={null}
        isAsking
        disabled
        userName="driver"
        onSend={vi.fn()}
      />,
    );

    expect(transcript.scrollTop).toBe(20);
  });
});
