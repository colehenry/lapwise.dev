// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChatInput from "./ChatInput";

describe("ChatInput", () => {
  it("prefills a question passed from another app surface", () => {
    render(
      <ChatInput
        onSend={vi.fn()}
        isLoading={false}
        initialValue="Compare the 2025 title contenders"
      />,
    );

    expect(
      (
        screen.getByRole("textbox", {
          name: "Message Clutch",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("Compare the 2025 title contenders");
  });

  it("caps vertical growth and scrolls long drafts inside the composer", () => {
    render(<ChatInput onSend={vi.fn()} isLoading={false} shellless />);
    const textarea = screen.getByRole("textbox", {
      name: "Message Clutch",
    });
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      value: 400,
    });

    fireEvent.change(textarea, { target: { value: "A long draft" } });

    expect(textarea.style.height).toBe("144px");
    expect(textarea.style.overflowY).toBe("auto");
  });

  it("prevents sends while conversation history is loading", () => {
    render(<ChatInput onSend={vi.fn()} isLoading={false} disabled shellless />);

    expect(
      (
        screen.getByRole("textbox", {
          name: "Message Clutch",
        }) as HTMLTextAreaElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Send message",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
