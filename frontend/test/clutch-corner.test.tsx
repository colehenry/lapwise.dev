// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClutchCorner from "@/components/clutch/ClutchCorner";
import ClutchDockProvider, {
  useClutchDock,
} from "@/components/providers/ClutchDockProvider";
import type { ClutchHandoff } from "@/lib/clutch/handoff";
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
const pageContext = { route: "/results/2025", season: 2025 };

/** Reads what the corner handed to the dock. */
function Probe({ onHandoff }: { onHandoff: (h: ClutchHandoff) => void }) {
  const { handoff } = useClutchDock();
  if (handoff) onHandoff(handoff);
  return null;
}

function renderCorner(onHandoff = vi.fn(), title = "the standings") {
  const view = render(
    <ClutchDockProvider>
      <ClutchCorner
        surface={surface}
        context={context}
        title={title}
        pageContext={pageContext}
      />
      <Probe onHandoff={onHandoff} />
    </ClutchDockProvider>,
  );
  return {
    ...view,
    onHandoff,
    head: screen.getByRole("button", { name: `Ask Clutch about ${title}` }),
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
      <ClutchDockProvider>
        <ClutchCorner
          surface={surface}
          context={{ leader: null, margin: null }}
          title="nothing"
          pageContext={pageContext}
        />
      </ClutchDockProvider>,
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
    const { head, onHandoff } = renderCorner();
    fireEvent.click(head);

    fireEvent.click(screen.getByRole("button", { name: "By how much?" }));
    expect(
      screen.getByRole("dialog", { name: "By how much?" }).textContent,
    ).toContain("By 22 points.");
    expect(onHandoff).not.toHaveBeenCalled();

    /* A second hop is the depth limit: the script follow-up becomes a hand-off,
       and the whole trail travels with it. */
    fireEvent.click(screen.getByRole("button", { name: "Who is leading?" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const handoff = onHandoff.mock.calls[0][0] as ClutchHandoff;
    expect(handoff.question).toBe("Who is leading?");
    expect(handoff.title).toBe("the standings");
    expect(handoff.trail.map((script) => script.id)).toEqual([
      "leader",
      "margin",
    ]);
    /* This surface has no digest, so the page context goes as it came. */
    expect(handoff.pageContext).toEqual(pageContext);
  });

  it("hands off a typed question", () => {
    layout(600);
    const { head, onHandoff } = renderCorner();
    fireEvent.click(head);
    const input = screen.getByRole("textbox", {
      name: "Ask Clutch your own question",
    });
    fireEvent.change(input, { target: { value: "  Why?  " } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(onHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "Why?",
        trail: [expect.objectContaining({ id: "leader" })],
      }),
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

  it("puts its tail under the head's centre, and flips at the viewport edge", () => {
    layout(600);
    const { head } = renderCorner();
    fireEvent.pointerEnter(head, { pointerType: "mouse" });
    const bubble = screen.getByRole("tooltip");
    /* Head centre is 586; the tail sits 18px in from the bubble's left edge. */
    expect(bubble.style.left).toBe(`${586 - 18}px`);
    expect(bubble.style.top).toBe(`${300 - 6 - 40}px`);
    expect(bubble.style.transformOrigin).toBe("bottom left");
    vi.restoreAllMocks();

    layout(1190);
    const { head: edgeHead } = renderCorner(vi.fn(), "the edge");
    fireEvent.pointerEnter(edgeHead, { pointerType: "mouse" });
    const flipped = screen.getByRole("tooltip");
    expect(flipped.style.left).toBe(`${1176 + 18 - 240}px`);
    expect(flipped.style.transformOrigin).toBe("bottom right");
  });
});
