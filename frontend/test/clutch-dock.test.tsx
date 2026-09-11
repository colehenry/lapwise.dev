// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClutchDock from "@/components/clutch/ClutchDock";
import ClutchDockProvider, {
  useClutchDock,
} from "@/components/providers/ClutchDockProvider";
import type { ClutchHandoff } from "@/lib/clutch/handoff";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/results/2025/1",
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
  error: null,
  pendingConversationId: null,
  startNewConversation: vi.fn(),
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

function renderDock() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ClutchDockProvider>
        <Trigger />
        <ClutchDock />
      </ClutchDockProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
  chat.messages = [];
  chat.activeConversationId = null;
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
