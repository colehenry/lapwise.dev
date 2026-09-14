// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AskStreamEvent, ChatMessage } from "@/lib/chat";
import { useAskChat } from "./useAskChat";

const chatApi = vi.hoisted(() => ({
  deleteConversation: vi.fn(),
  fetchCachedResponse: vi.fn(),
  getConversation: vi.fn(),
  isAbortError: (error: unknown) =>
    error instanceof Error && error.name === "AbortError",
  listConversations: vi.fn(),
  renameConversation: vi.fn(),
  streamQuestion: vi.fn(),
}));

vi.mock("@/lib/chat", () => chatApi);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })
      }
    >
      {children}
    </QueryClientProvider>
  );
}

function storedMessage(id: string, content: string): ChatMessage {
  return {
    id,
    role: "assistant",
    content,
    tool_calls: null,
    tool_results: null,
    tokens_used: null,
    model: null,
    created_at: "2026-09-08T00:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  chatApi.fetchCachedResponse.mockResolvedValue(null);
  chatApi.listConversations.mockResolvedValue([]);
});

describe("useAskChat", () => {
  it("serves sample questions from the response cache", async () => {
    chatApi.fetchCachedResponse.mockResolvedValue({
      text: "Cached analysis",
      charts: [],
      queries: ["SELECT 1"],
      followUps: ["What happened next?"],
    });
    const { result } = renderHook(() => useAskChat(1), { wrapper });

    await act(async () => {
      await result.current.sendMessage(
        "Which driver has the most wins at Monza?",
      );
    });

    expect(chatApi.fetchCachedResponse).toHaveBeenCalledTimes(1);
    expect(chatApi.streamQuestion).not.toHaveBeenCalled();
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        role: "assistant",
        content: "Cached analysis",
        queries: ["SELECT 1"],
      }),
    );
  });

  it("synchronously prevents duplicate sends", async () => {
    const stream = deferred<void>();
    chatApi.streamQuestion.mockReturnValue(stream.promise);
    const { result } = renderHook(() => useAskChat(null), { wrapper });

    act(() => {
      void result.current.sendMessage("First");
      void result.current.sendMessage("Second");
    });

    expect(chatApi.streamQuestion).toHaveBeenCalledTimes(1);
    expect(chatApi.streamQuestion).toHaveBeenCalledWith(
      "First",
      undefined,
      expect.any(Function),
      expect.any(AbortSignal),
      undefined,
    );
    await act(async () => stream.resolve());
  });

  it("sends page context with a question", async () => {
    chatApi.streamQuestion.mockResolvedValue(undefined);
    const pageContext = {
      route: "/results/2024/8",
      season: 2024,
      round: 8,
      sessionId: 79,
      sessionType: "race" as const,
    };
    const { result } = renderHook(() => useAskChat(null, pageContext), {
      wrapper,
    });

    await act(async () => result.current.sendMessage("Who won this race?"));

    expect(chatApi.streamQuestion).toHaveBeenCalledWith(
      "Who won this race?",
      undefined,
      expect.any(Function),
      expect.any(AbortSignal),
      pageContext,
    );
  });

  it("ignores stream events after starting a new conversation", async () => {
    const stream = deferred<void>();
    let emit: ((event: AskStreamEvent) => void) | undefined;
    chatApi.streamQuestion.mockImplementation(
      (_question, _conversationId, onEvent) => {
        emit = onEvent;
        return stream.promise;
      },
    );
    const { result } = renderHook(() => useAskChat(null), { wrapper });

    act(() => {
      void result.current.sendMessage("Question");
    });
    act(() => result.current.startNewConversation());
    act(() => {
      emit?.({
        type: "metadata",
        conversationId: "stale-conversation",
        remaining: 2,
        charts: [],
        queries: [],
        followUps: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
    });
    await act(async () => stream.resolve());

    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.isAsking).toBe(false);
  });

  it("removes an empty assistant response when generation is stopped", async () => {
    chatApi.streamQuestion.mockImplementation(
      (_question, _conversationId, _onEvent, signal: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const { result } = renderHook(() => useAskChat(null), { wrapper });

    act(() => {
      void result.current.sendMessage("Question");
    });
    await act(async () => result.current.abortResponse());

    expect(result.current.messages).toEqual([
      expect.objectContaining({ role: "user", content: "Question" }),
    ]);
    expect(result.current.isAsking).toBe(false);
  });

  it("shows a stream failure instead of leaving an empty response", async () => {
    chatApi.streamQuestion.mockRejectedValue(
      new Error(
        "Clutch lost the connection before finishing. Please try again.",
      ),
    );
    const { result } = renderHook(() => useAskChat(1), { wrapper });

    await act(async () => result.current.sendMessage("Long question"));

    expect(result.current.error).toBe(
      "Clutch lost the connection before finishing. Please try again.",
    );
    expect(result.current.messages).toEqual([
      expect.objectContaining({ role: "user", content: "Long question" }),
    ]);
  });

  it("clears chat state when the signed-in user changes", () => {
    const stream = deferred<void>();
    chatApi.streamQuestion.mockReturnValue(stream.promise);
    const { result, rerender } = renderHook(
      ({ userId }) => useAskChat(userId),
      { wrapper, initialProps: { userId: 1 } },
    );

    act(() => {
      void result.current.sendMessage("Private question");
    });
    rerender({ userId: 2 });

    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.isAsking).toBe(false);
  });

  it("keeps the latest conversation when loads resolve out of order", async () => {
    const firstLoad = deferred<{
      conversation: never;
      messages: ChatMessage[];
    }>();
    const secondLoad = deferred<{
      conversation: never;
      messages: ChatMessage[];
    }>();
    chatApi.getConversation
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise);
    const { result } = renderHook(() => useAskChat(null), { wrapper });

    act(() => {
      void result.current.loadConversation("first");
      void result.current.loadConversation("second");
    });
    await act(async () =>
      secondLoad.resolve({
        conversation: undefined as never,
        messages: [storedMessage("second-message", "Second")],
      }),
    );
    await act(async () =>
      firstLoad.resolve({
        conversation: undefined as never,
        messages: [storedMessage("first-message", "First")],
      }),
    );

    expect(result.current.activeConversationId).toBe("second");
    expect(result.current.messages.map((message) => message.content)).toEqual([
      "Second",
    ]);
  });
});
