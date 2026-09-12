// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClutchDock from "@/components/clutch/ClutchDock";
import ClutchDockProvider, {
  useClutchDock,
  usePageSurface,
} from "@/components/providers/ClutchDockProvider";
import {
  rememberedDockWidth,
  rememberThread,
  threadFor,
} from "@/lib/clutch/dockMemory";
import type { ClutchHandoff } from "@/lib/clutch/handoff";
import type { Surface } from "@/lib/clutch/script";

const navigation = { pathname: "/results/2025/1" };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

const auth = {
  user: { id: 7, role: "user" } as { id: number; role: string } | null,
  isAuthenticated: true,
};
vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => auth,
}));

const chat = {
  activeConversationId: null as string | null,
  messages: [] as { id: string; role: "user" | "assistant"; content: string }[],
  isAsking: false,
  streamingAssistantId: null,
  streamStatus: null,
  remaining: 2,
  error: null as string | null,
  pendingConversationId: null,
  startNewConversation: vi.fn(),
  loadConversation: vi.fn(),
  abortResponse: vi.fn(),
  sendMessage: vi.fn(async () => {}),
};
const useAskChat = vi.fn((_userId: number | null, _context?: unknown) => chat);
vi.mock("@/hooks/useAskChat", () => ({
  useAskChat: (userId: number | null, context?: unknown) =>
    useAskChat(userId, context),
}));

const handoff: Omit<ClutchHandoff, "seq"> = {
  question: "What decided this race?",
  trail: [
    {
      id: "winner",
      question: "Who won, and by how much?",
      segments: [
        { text: "Norris won by 0.9s.", code: null, tint: null, color: null },
      ],
      followups: [
        {
          kind: "script",
          id: "fastest-lap",
          question: "Who set the fastest lap?",
        },
        { kind: "ask", question: "What decided this race?" },
      ],
    },
  ],
  title: "Australian Grand Prix · Race",
  pageContext: { route: "/results/2025/1", sessionId: 1234 },
};

function Trigger() {
  const { handOff } = useClutchDock();
  return (
    <button type="button" onClick={() => handOff(handoff)}>
      hand off
    </button>
  );
}

type PageCtx = { winner: string | null };
const pageSurface: Surface<PageCtx> = {
  scripts: [
    {
      id: "winner",
      question: "Who won?",
      parts: [{ slot: "winner", tint: "driver" }, { text: " won." }],
      followups: [],
    },
  ],
  resolveSlot: (context) =>
    context.winner ? { text: context.winner, code: context.winner } : null,
  digest: () => null,
};
const pageCtx: PageCtx = { winner: "NOR" };
const pageRoute = { route: "/results/2025/1", sessionId: 1234 };

/** A page with its own corner, registered for the dock's head to answer. */
function Page({ context = pageCtx }: { context?: PageCtx | null }) {
  usePageSurface(pageSurface, context, "Australian Grand Prix", pageRoute);
  return null;
}

function renderDock(page?: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const build = () => (
    <QueryClientProvider client={client}>
      <ClutchDockProvider>
        {page}
        <Trigger />
        <ClutchDock />
      </ClutchDockProvider>
    </QueryClientProvider>
  );
  const view = render(build());
  /* The chat hook is a mock: after changing its state, render the tree again
     (a fresh element, or React skips the unchanged subtree) so the dock sees it. */
  return { ...view, rerender: () => view.rerender(build()) };
}

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  navigation.pathname = "/results/2025/1";
  chat.messages = [];
  chat.activeConversationId = null;
  chat.error = null;
  auth.user = { id: 7, role: "user" };
  auth.isAuthenticated = true;
});

describe("ClutchDock", () => {
  it("stays out of the way until a corner hands off", () => {
    renderDock();
    expect(screen.queryByRole("region", { name: "Clutch" })).toBeNull();

    fireEvent.click(screen.getByText("hand off"));
    expect(screen.getByRole("region", { name: "Clutch" })).toBeTruthy();
    expect(screen.getByText("Australian Grand Prix · Race")).toBeTruthy();
  });

  it("starts a new thread from the corner's answer and sends the question", () => {
    renderDock();
    fireEvent.click(screen.getByText("hand off"));

    expect(useAskChat).toHaveBeenLastCalledWith(7, handoff.pageContext);
    expect(chat.startNewConversation).toHaveBeenCalled();
    expect(chat.sendMessage).toHaveBeenCalledWith("What decided this race?");

    const log = screen.getByRole("log");
    expect(log.textContent).toContain("Who won, and by how much?");
    expect(log.textContent).toContain("Norris won by 0.9s.");
  });

  it("offers the unasked follow-ups until one is used", () => {
    renderDock();
    fireEvent.click(screen.getByText("hand off"));
    const chip = screen.getByRole("button", {
      name: "Who set the fastest lap?",
    });
    expect(
      screen.queryByRole("button", { name: "What decided this race?" }),
    ).toBeNull();
    fireEvent.click(chip);
    expect(chat.sendMessage).toHaveBeenCalledWith("Who set the fastest lap?");
    expect(
      screen.queryByRole("button", { name: "Who set the fastest lap?" }),
    ).toBeNull();
  });

  it("collapses to the head and comes back", () => {
    renderDock();
    fireEvent.click(screen.getByText("hand off"));
    fireEvent.click(screen.getByRole("button", { name: "Collapse Clutch" }));
    expect(screen.queryByRole("region", { name: "Clutch" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open Clutch" }));
    expect(screen.getByRole("region", { name: "Clutch" })).toBeTruthy();
  });

  it("links the full workspace to the same conversation", () => {
    chat.activeConversationId = "abc-123";
    renderDock();
    fireEvent.click(screen.getByText("hand off"));
    expect(
      screen.getByRole("link", { name: "Open in Clutch" }).getAttribute("href"),
    ).toBe("/ask?c=abc-123");
  });

  it("remembers the thread for the page and resumes it next time", () => {
    const { rerender, unmount } = renderDock();
    fireEvent.click(screen.getByText("hand off"));
    expect(chat.startNewConversation).toHaveBeenCalled();

    /* The server answers with a conversation id: that is now this page's. */
    chat.activeConversationId = "conv-1";
    rerender();
    unmount();
    expect(threadFor(7, "/results/2025/1")?.conversationId).toBe("conv-1");

    /* Next visit: the corner's question joins the same conversation. */
    chat.activeConversationId = null;
    chat.startNewConversation.mockClear();
    chat.sendMessage.mockClear();
    const second = renderDock();
    fireEvent.click(screen.getByText("hand off"));
    expect(chat.loadConversation).toHaveBeenCalledWith("conv-1");
    expect(chat.startNewConversation).not.toHaveBeenCalled();
    expect(chat.sendMessage).not.toHaveBeenCalled();

    chat.activeConversationId = "conv-1";
    chat.messages = [{ id: "m1", role: "user", content: "earlier" }];
    second.rerender();
    /* Loaded history is the transcript; the corner's answer is not re-seeded. */
    expect(screen.getByRole("log").textContent).toContain("earlier");
    expect(screen.getByRole("log").textContent).not.toContain(
      "Norris won by 0.9s.",
    );
  });

  it("forgets a remembered thread that no longer loads", () => {
    rememberThread(7, "/results/2025/1", {
      conversationId: "gone",
      title: "x",
    });
    const { rerender } = renderDock();
    fireEvent.click(screen.getByText("hand off"));
    expect(chat.loadConversation).toHaveBeenCalledWith("gone");

    chat.error = "Failed to load conversation";
    rerender();
    expect(threadFor(7, "/results/2025/1")).toBeNull();
    expect(chat.startNewConversation).toHaveBeenCalled();
  });

  it("belongs to the page: gone elsewhere, back folded on a page with a thread", () => {
    rememberThread(7, "/drivers/norris", {
      conversationId: "conv-nor",
      title: "Lando Norris",
    });
    const { rerender } = renderDock();
    fireEvent.click(screen.getByText("hand off"));
    expect(screen.getByRole("region", { name: "Clutch" })).toBeTruthy();

    /* A page with no thread keeps Clutch in the corner as a link to /ask. */
    navigation.pathname = "/results/2025";
    rerender();
    expect(screen.queryByRole("region", { name: "Clutch" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open Clutch" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Ask Clutch" }).getAttribute("href"),
    ).toBe("/ask");

    /* A page with a remembered thread gets its head, folded, and expanding
       it loads that page's conversation — never the one from before. */
    chat.loadConversation.mockClear();
    navigation.pathname = "/drivers/norris";
    rerender();
    expect(screen.queryByRole("region", { name: "Clutch" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open Clutch" }));
    expect(chat.loadConversation).toHaveBeenCalledWith("conv-nor");
    expect(chat.sendMessage).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Lando Norris")).toBeTruthy();
  });

  it("answers for the page from the corner when the page registers a surface", () => {
    renderDock(<Page />);
    expect(screen.queryByRole("link", { name: "Ask Clutch" })).toBeNull();
    const head = screen.getByRole("button", {
      name: "Ask Clutch about Australian Grand Prix",
    });
    fireEvent.pointerEnter(head, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip").textContent).toBe("Who won?");
    fireEvent.click(head);
    expect(screen.getByRole("dialog").textContent).toContain("NOR won.");
  });

  it("falls back to /ask when the page's surface has nothing to say", () => {
    renderDock(<Page context={{ winner: null }} />);
    expect(screen.getByRole("link", { name: "Ask Clutch" })).toBeTruthy();
  });

  it("shows a page's remembered thread before any hand-off this session", () => {
    rememberThread(7, "/results/2025/1", {
      conversationId: "conv-1",
      title: "Australian GP",
    });
    renderDock();
    expect(screen.getByRole("button", { name: "Open Clutch" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Clutch" })).toBeNull();
  });

  it("widens from its left edge and keeps the width", () => {
    vi.stubGlobal("innerWidth", 1400);
    renderDock();
    fireEvent.click(screen.getByText("hand off"));
    const handle = screen.getByRole("separator", { name: "Resize Clutch" });
    const region = screen.getByRole("region", { name: "Clutch" });
    expect(region.style.getPropertyValue("--dock-width")).toBe("360px");

    fireEvent.pointerDown(handle, { clientX: 900, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 700, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 700, pointerId: 1 });
    expect(region.style.getPropertyValue("--dock-width")).toBe("560px");
    expect(rememberedDockWidth()).toBe(560);

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(region.style.getPropertyValue("--dock-width")).toBe("536px");
    vi.unstubAllGlobals();
  });

  it("asks a signed-out reader to sign in, keeping the question", () => {
    auth.user = null;
    auth.isAuthenticated = false;
    renderDock();
    act(() => {
      fireEvent.click(screen.getByText("hand off"));
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByText("What decided this race?")).toBeTruthy();
    const href = screen
      .getByRole("link", { name: "Sign in" })
      .getAttribute("href");
    expect(href).toContain("/login?redirect=");
    expect(decodeURIComponent(href ?? "")).toContain(
      "q=What+decided+this+race",
    );
  });
});
