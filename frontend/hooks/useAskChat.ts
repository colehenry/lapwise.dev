"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { isSuggestedQuestion } from "@/lib/ai/suggestions";
import {
  type AskStreamEvent,
  deleteConversation,
  fetchCachedResponse,
  getConversation,
  renameConversation,
  streamQuestion,
} from "@/lib/chat";
import {
  appendStreamText,
  appendThinkingStep,
  attachCachedResponse,
  attachStreamMetadata,
  type DisplayMessage,
  removeEmptyAssistant,
  toDisplayMessages,
} from "@/lib/chatMessages";
import {
  conversationsQuery,
  invalidateConversations,
  removeCachedConversation,
} from "@/lib/queries/conversations";

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function useAskChat(userId: number | null) {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [streamingAssistantId, setStreamingAssistantId] = useState<
    string | null
  >(null);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingConversationId, setPendingConversationId] = useState<
    string | null
  >(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const isAskingRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const conversationLoadSequenceRef = useRef(0);
  const sessionUserIdRef = useRef(userId);
  const { data: conversations = [] } = useQuery(conversationsQuery(userId));

  const cancelActiveStream = useCallback(() => {
    requestSequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    isAskingRef.current = false;
    setIsAsking(false);
    setStreamingAssistantId(null);
    setStreamStatus(null);
  }, []);

  const startNewConversation = useCallback(() => {
    conversationLoadSequenceRef.current += 1;
    cancelActiveStream();
    setPendingConversationId(null);
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
  }, [cancelActiveStream]);

  const loadConversation = useCallback(
    async (conversationId: string) => {
      const loadSequence = ++conversationLoadSequenceRef.current;
      cancelActiveStream();
      setPendingConversationId(conversationId);

      try {
        const data = await getConversation(conversationId);
        if (conversationLoadSequenceRef.current !== loadSequence) return;

        setActiveConversationId(conversationId);
        setMessages(toDisplayMessages(data.messages));
        setError(null);
      } catch (loadError) {
        if (conversationLoadSequenceRef.current !== loadSequence) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load conversation",
        );
      } finally {
        if (conversationLoadSequenceRef.current === loadSequence) {
          setPendingConversationId(null);
        }
      }
    },
    [cancelActiveStream],
  );

  const abortResponse = useCallback(() => abortRef.current?.abort(), []);

  const renameConversationTitle = useCallback(
    async (id: string, title: string) => {
      try {
        await renameConversation(id, title);
        await invalidateConversations(queryClient, userId);
      } catch (renameError) {
        setError(
          renameError instanceof Error
            ? renameError.message
            : "Failed to rename conversation",
        );
      }
    },
    [queryClient, userId],
  );

  const removeConversation = useCallback(
    async (id: string) => {
      setDeletingId(id);
      removeCachedConversation(queryClient, userId, id);
      if (activeConversationId === id) startNewConversation();

      try {
        await deleteConversation(id);
      } catch (deleteError) {
        await invalidateConversations(queryClient, userId);
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete conversation",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [activeConversationId, queryClient, startNewConversation, userId],
  );

  const sendMessage = useCallback(
    async (question: string) => {
      if (isAskingRef.current) return;

      conversationLoadSequenceRef.current += 1;
      setPendingConversationId(null);
      isAskingRef.current = true;
      setIsAsking(true);
      setError(null);

      const requestSequence = ++requestSequenceRef.current;
      const messageSequence = `${Date.now()}-${requestSequence}`;
      const assistantMessageId = `assistant-${messageSequence}`;
      const controller = new AbortController();
      abortRef.current = controller;

      setStreamingAssistantId(assistantMessageId);
      setStreamStatus("Starting analysis...");
      setMessages((previous) => [
        ...previous,
        { id: `user-${messageSequence}`, role: "user", content: question },
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          steps: [],
        },
      ]);

      try {
        if (!activeConversationId && isSuggestedQuestion(question)) {
          const cached = await fetchCachedResponse(question, controller.signal);
          if (requestSequenceRef.current !== requestSequence) return;
          if (cached) {
            setStreamStatus(null);
            setMessages((previous) =>
              attachCachedResponse(previous, assistantMessageId, cached),
            );
            return;
          }
        }

        await streamQuestion(
          question,
          activeConversationId ?? undefined,
          (event: AskStreamEvent) => {
            if (requestSequenceRef.current !== requestSequence) return;

            if (event.type === "init") {
              setActiveConversationId(event.conversationId);
              setRemaining(event.remaining);
              return;
            }

            if (event.type === "text-delta") {
              setStreamStatus(null);
              setMessages((previous) =>
                appendStreamText(previous, assistantMessageId, event.text),
              );
              return;
            }

            if (event.type === "status") {
              const { message, stepType } = event;
              setStreamStatus(message);
              if (!stepType) return;

              setMessages((previous) =>
                appendThinkingStep(previous, assistantMessageId, {
                  message,
                  stepType,
                  timestamp: Date.now(),
                }),
              );
              return;
            }

            if (event.type === "metadata") {
              setActiveConversationId(event.conversationId);
              setRemaining(event.remaining);
              setStreamStatus(null);
              setMessages((previous) =>
                attachStreamMetadata(previous, assistantMessageId, event),
              );
              return;
            }

            if (event.type === "error") throw new Error(event.error);
          },
          controller.signal,
        );
      } catch (streamError) {
        if (requestSequenceRef.current !== requestSequence) return;

        if (isAbortError(streamError)) {
          setMessages((previous) =>
            removeEmptyAssistant(previous, assistantMessageId),
          );
        } else {
          setError(
            streamError instanceof Error
              ? streamError.message
              : "Something went wrong",
          );
          setMessages((previous) =>
            removeEmptyAssistant(previous, assistantMessageId),
          );
        }
      } finally {
        if (requestSequenceRef.current === requestSequence) {
          isAskingRef.current = false;
          abortRef.current = null;
          setStreamingAssistantId(null);
          setStreamStatus(null);
          setIsAsking(false);
          await invalidateConversations(queryClient, userId);
        }
      }
    },
    [activeConversationId, queryClient, userId],
  );

  useEffect(() => {
    if (sessionUserIdRef.current === userId) return;
    sessionUserIdRef.current = userId;
    startNewConversation();
  }, [startNewConversation, userId]);

  useEffect(
    () => () => {
      requestSequenceRef.current += 1;
      abortRef.current?.abort();
    },
    [],
  );
  return {
    activeConversationId,
    conversations,
    messages,
    isAsking,
    streamingAssistantId,
    streamStatus,
    remaining,
    error,
    pendingConversationId,
    deletingId,
    startNewConversation,
    loadConversation,
    abortResponse,
    renameConversationTitle,
    removeConversation,
    sendMessage,
  };
}
