"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ChatInput from "@/components/chat/ChatInput";
import ChatMessage from "@/components/chat/ChatMessage";
import ConversationSidebar from "@/components/chat/ConversationSidebar";
import SuggestedQuestions from "@/components/chat/SuggestedQuestions";
import PageHeader from "@/components/PageHeader";
import {
  type AskStreamEvent,
  type ChartConfig,
  deleteConversation,
  getConversation,
  listConversations,
  streamQuestion,
} from "@/lib/chat";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  charts?: ChartConfig[];
  queries?: string[];
}

const DAILY_LIMIT = 20;

function parseStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return undefined;
}

function parseChartArray(value: unknown): ChartConfig[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value as ChartConfig[];
}

export default function AskPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations list
  const { data: conversations = [] } = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: listConversations,
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll after chat updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isAsking]);

  // Load a conversation's messages
  const loadConversation = useCallback(async (convId: string) => {
    try {
      const data = await getConversation(convId);
      setActiveConversationId(convId);
      setMessages(
        data.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            charts: parseChartArray(m.tool_results),
            queries: parseStringArray(m.tool_calls),
          })),
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load conversation",
      );
    }
  }, []);

  // Start a new conversation
  function handleNewConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setStreamingAssistantId(null);
    setStreamStatus(null);
    setError(null);
  }

  // Delete a conversation
  async function handleDeleteConversation(id: string) {
    try {
      await deleteConversation(id);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      if (activeConversationId === id) {
        handleNewConversation();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete conversation",
      );
    }
  }

  // Send a message
  async function handleSend(question: string) {
    setError(null);
    setIsAsking(true);
    setStreamStatus("Starting analysis...");

    // Add user message immediately
    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };
    const assistantMsgId = `assistant-${Date.now()}`;

    setMessages((prev) => [...prev, userMsg]);
    setStreamingAssistantId(assistantMsgId);

    try {
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
        },
      ]);

      await streamQuestion(
        question,
        activeConversationId ?? undefined,
        (event: AskStreamEvent) => {
          if (event.type === "init") {
            if (!activeConversationId) {
              setActiveConversationId(event.conversationId);
            }
            setRemaining(event.remaining);
            return;
          }

          if (event.type === "text-delta") {
            setStreamStatus("Writing report...");
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMsgId
                  ? { ...message, content: message.content + event.text }
                  : message,
              ),
            );
            return;
          }

          if (event.type === "status") {
            setStreamStatus(event.message);
            return;
          }

          if (event.type === "metadata") {
            setActiveConversationId(event.conversationId);
            setRemaining(event.remaining);
            setStreamStatus(null);
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMsgId
                  ? {
                      ...message,
                      charts: event.charts,
                      queries: event.queries,
                    }
                  : message,
              ),
            );
            return;
          }

          if (event.type === "error") {
            throw new Error(event.error);
          }
        },
      );

      // Refresh conversations list
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Something went wrong";
      setError(errorMessage);
      setMessages((prev) =>
        prev.filter(
          (message) =>
            message.id !== assistantMsgId || message.content.trim().length > 0,
        ),
      );
    } finally {
      setStreamingAssistantId(null);
      setStreamStatus(null);
      setIsAsking(false);
    }
  }

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-secondary flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-bg-secondary">
        <PageHeader title="AI Analyst" subtitle="F1 Data Analysis" />
        <div className="flex flex-col items-center justify-center py-32 px-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-purple-500/15 border border-purple-500/30 mb-6">
            <span className="text-purple-400 font-bold text-xl">F1</span>
          </div>
          <h2 className="text-text-primary text-lg font-bold mb-2">
            Sign in to use the AI Analyst
          </h2>
          <p className="text-text-muted text-sm mb-6 text-center max-w-md">
            Ask any question about Formula 1 and get expert analysis powered by
            AI.
          </p>
          <Link
            href="/login?redirect=/ask"
            className="bg-purple-500 text-text-primary px-6 py-2.5 rounded-lg font-medium text-sm hover:bg-purple-600 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="min-h-screen bg-bg-secondary flex flex-col">
      <PageHeader title="AI Analyst" subtitle="F1 Data Analysis">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="md:hidden bg-bg-primary border border-border-primary text-text-primary font-mono text-xs font-bold px-3 py-2 rounded-sm hover:border-purple-500 transition-colors"
        >
          History
        </button>
      </PageHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={loadConversation}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages or empty state */}
          <div className="flex-1 overflow-y-auto">
            {!hasMessages ? (
              <SuggestedQuestions onSelect={handleSend} />
            ) : (
              <div className="max-w-4xl mx-auto px-4 py-4">
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    messageRole={msg.role}
                    content={msg.content}
                    charts={msg.charts}
                    queries={msg.queries}
                    isLoading={
                      msg.id === streamingAssistantId &&
                      !msg.content &&
                      !(msg.charts && msg.charts.length > 0)
                    }
                    statusText={
                      msg.id === streamingAssistantId ? streamStatus : null
                    }
                  />
                ))}
                {error && (
                  <div className="py-3 px-4 bg-red-500/10 border border-red-500/20 rounded-sm text-red-400 text-sm">
                    {error}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <ChatInput
            onSend={handleSend}
            isLoading={isAsking}
            remaining={remaining}
            dailyLimit={DAILY_LIMIT}
          />
        </div>
      </div>
    </div>
  );
}
