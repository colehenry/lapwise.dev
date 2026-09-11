// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClutchCorner from "@/components/clutch/ClutchCorner";
import type { ClutchScript, Surface } from "@/lib/clutch/script";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

type Ctx = { leader: string | null; margin: string | null };

const scripts: ClutchScript[] = [
  {
    id: "leader",
    question: "Who is leading?",
    parts: [{ slot: "leader", tint: "driver" }, { text: " is leading." }],
    followups: [{ script: "margin" }, { ask: "Can {leader} hold on?" }],
  },
  {
    id: "margin",
    question: "By how much?",
    parts: [{ text: "By " }, { slot: "margin" }, { text: "." }],
    followups: [{ script: "leader" }],
  },
];

const surface: Surface<Ctx> = {
  scripts,
  resolveSlot: (context, slot) => {
    const value = slot === "leader" ? context.leader : context.margin;
    return value ? { text: value, code: value, color: "#FF8000" } : null;
  },
  digest: () => null,
};

const context: Ctx = { leader: "NOR", margin: "22 points" };

function renderCorner(onAsk = vi.fn(), label = "the standings") {
  const view = render(
    <ClutchCorner
      surface={surface}
      context={context}
      label={label}
      onAsk={onAsk}
    />,
  );
  return {
    ...view,
    onAsk,
    head: screen.getByRole("button", { name: `Ask Clutch about ${label}` }),
  };
}

/** jsdom lays nothing out; the head's box and the bubble's size are stubbed. */
function layout(headRight: number, bubbleWidth = 240, viewport = 1200) {
  vi.stubGlobal("innerWidth", viewport);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: headRight - 28,
    right: headRight,
    top: 300,
    bottom: 328,
    width: 28,
    height: 28,
    x: headRight - 28,
    y: 300,
    toJSON: () => ({}),
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
    bubbleWidth,
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ClutchCorner", () => {
  it("rests as the head alone and renders nothing without a script", () => {
    renderCorner();
    expect(screen.queryByText("Who is leading?")).toBeNull();

    const { container } = render(
      <ClutchCorner
        surface={surface}
        context={{ leader: null, margin: null }}
        label="nothing"
        onAsk={vi.fn()}
      />,
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("shows the question on hover and the answer on click", () => {
    layout(600);
    const { head } = renderCorner();

    fireEvent.pointerEnter(head, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip").textContent).toContain(
      "Who is leading?",
    );
    expect(head.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(head);
    const dialog = screen.getByRole("dialog", { name: "Who is leading?" });
    expect(dialog.textContent).toContain("NOR is leading.");
    expect(screen.getByRole("link", { name: "NOR" }).getAttribute("href")).toBe(
      "/drivers/NOR",
    );
    expect(screen.getByRole("button", { name: "By how much?" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Can NOR hold on?" }),
    ).toBeTruthy();
  });

  it("closes the question when the pointer leaves, after a beat", () => {
    vi.useFakeTimers();
    layout(600);
    const { head } = renderCorner();
    fireEvent.pointerEnter(head, { pointerType: "mouse" });
    fireEvent.pointerLeave(head);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("answers a script follow-up in place and hands off an ask", () => {
    layout(600);
    const { head, onAsk } = renderCorner();
    fireEvent.click(head);

    fireEvent.click(screen.getByRole("button", { name: "By how much?" }));
    expect(
      screen.getByRole("dialog", { name: "By how much?" }).textContent,
    ).toContain("By 22 points.");
    expect(onAsk).not.toHaveBeenCalled();

    /* A second hop is the depth limit: the script follow-up becomes a hand-off. */
    fireEvent.click(screen.getByRole("button", { name: "Who is leading?" }));
    expect(onAsk).toHaveBeenCalledWith(
      "Who is leading?",
      expect.objectContaining({ id: "margin" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("hands off a typed question", () => {
    layout(600);
    const { head, onAsk } = renderCorner();
    fireEvent.click(head);
    const input = screen.getByRole("textbox", {
      name: "Ask Clutch your own question",
    });
    fireEvent.change(input, { target: { value: "  Why?  " } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(onAsk).toHaveBeenCalledWith(
      "Why?",
      expect.objectContaining({ id: "leader" }),
    );
  });

  it("closes on Escape and on a click outside", () => {
    layout(600);
    const { head } = renderCorner();
    fireEvent.click(head);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(head);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps one bubble open at a time", () => {
    layout(600);
    const first = renderCorner(vi.fn(), "the first panel");
    const second = renderCorner(vi.fn(), "the second panel");
    fireEvent.click(first.head);
    fireEvent.click(second.head);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(first.head.getAttribute("aria-expanded")).toBe("false");
    expect(second.head.getAttribute("aria-expanded")).toBe("true");

    /* The first corner starts over from its question, not its stale answer. */
    fireEvent.pointerEnter(first.head, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip").textContent).toContain(
      "Who is leading?",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("pops top-right of the head, and flips left at the viewport edge", () => {
    layout(600);
    const { head } = renderCorner();
    fireEvent.pointerEnter(head, { pointerType: "mouse" });
    const bubble = screen.getByRole("tooltip");
    expect(bubble.style.left).toBe(`${600 - 8}px`);
    expect(bubble.style.top).toBe(`${300 - 4 - 40}px`);
    vi.restoreAllMocks();

    layout(1190);
    const { head: edgeHead } = renderCorner(vi.fn(), "the edge");
    fireEvent.pointerEnter(edgeHead, { pointerType: "mouse" });
    const flipped = screen.getByRole("tooltip");
    expect(flipped.style.left).toBe(`${1190 - 28 + 8 - 240}px`);
  });
});
