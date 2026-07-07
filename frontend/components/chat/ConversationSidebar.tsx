"use client";

import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { ChatConversation } from "@/lib/chat";

interface ConversationSidebarProps {
  conversations: ChatConversation[];
  activeId: string | null;
  pendingId?: string | null;
  deletingId?: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ConversationSidebar({
  conversations,
  activeId,
  pendingId,
  deletingId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  isOpen,
  onClose,
}: ConversationSidebarProps) {
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (deletingId === id || removingIds.has(id)) return;
    setRemovingIds((prev) => new Set([...prev, id]));
    setTimeout(() => {
      onDelete(id);
    }, 280);
  }

  function startEdit(e: React.MouseEvent, conv: ChatConversation) {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title || "");
  }

  function commitEdit(id: string) {
    const trimmed = editTitle.trim();
    if (trimmed && onRename) {
      onRename(id, trimmed);
    }
    setEditingId(null);
  }

  function handleEditKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit(id);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  }

  return (
    <div
      className={`theme-glass-panel absolute inset-y-0 right-0 z-10 min-h-0 overflow-hidden border-l transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isOpen
          ? "w-72 translate-x-0 opacity-100"
          : "w-72 translate-x-full border-l-0 opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex h-full min-h-0 w-72 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3.5">
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-[0.1em] text-text-secondary">
            History
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onNew();
                onClose();
              }}
              className="theme-glass-card rounded-lg px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.1em] text-text-muted transition-all hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-300"
            >
              + New Chat
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-text-secondary"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <title>Close sidebar</title>
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <div className="theme-glass-card mb-3 flex h-10 w-10 items-center justify-center rounded-2xl">
                <svg
                  className="h-5 w-5 text-text-muted"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <title>No conversations</title>
                  <path
                    fillRule="evenodd"
                    d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.670 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.422l1.617 3.236a.75.75 0 001.348-.024l1.52-3.283a.727.727 0 01.613-.38 49.69 49.69 0 003.85-.462c1.428-.261 2.43-1.51 2.43-2.924V5.426c0-1.412-.993-2.67-2.43-2.902A49.21 49.21 0 0010 2zm0 6.75a.75.75 0 000 1.5h.007a.75.75 0 000-1.5H10zm-3 .75a.75.75 0 01.75-.75h.007a.75.75 0 010 1.5H7.75a.75.75 0 01-.75-.75zm6.75-.75a.75.75 0 000 1.5h.007a.75.75 0 000-1.5h-.007z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-xs text-text-muted">No conversations yet</p>
              <p className="mt-0.5 text-[10px] text-text-muted/60">
                Start asking to build history
              </p>
            </div>
          ) : (
            <div className="space-y-0.5 p-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group relative overflow-hidden transition-all duration-300 ease-in-out ${
                    removingIds.has(conv.id)
                      ? "max-h-0 opacity-0 pointer-events-none"
                      : "max-h-24 opacity-100"
                  }`}
                >
                  {editingId === conv.id ? (
                    <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.08] px-3 py-2.5">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, conv.id)}
                        onBlur={() => commitEdit(conv.id)}
                        ref={(el) => el?.focus()}
                        className="w-full rounded bg-bg-primary/80 px-1.5 py-0.5 text-xs text-text-primary outline-none focus:ring-1 focus:ring-purple-500/40"
                      />
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (pendingId === conv.id) return;
                          onSelect(conv.id);
                          onClose();
                        }}
                        disabled={pendingId === conv.id}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
                          activeId === conv.id || pendingId === conv.id
                            ? "border border-purple-500/20 bg-purple-500/[0.08] text-purple-200"
                            : "border border-transparent text-text-secondary hover:bg-[var(--glass-surface-soft)] hover:text-text-primary"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 pr-14">
                          {pendingId === conv.id && (
                            <svg
                              className="h-3 w-3 shrink-0 animate-spin text-purple-400"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <title>Loading</title>
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                          )}
                          <span className="truncate text-xs font-medium leading-snug">
                            {conv.title || "Untitled"}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.08em] text-text-muted">
                          {formatDistanceToNow(new Date(conv.updated_at), {
                            addSuffix: true,
                          })}
                        </div>
                      </button>

                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onRename && (
                          <button
                            type="button"
                            onClick={(e) => startEdit(e, conv)}
                            className="rounded-lg p-1.5 text-text-muted transition-all hover:text-text-secondary"
                            title="Rename"
                          >
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <title>Rename</title>
                              <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, conv.id)}
                          disabled={
                            deletingId === conv.id || removingIds.has(conv.id)
                          }
                          className={`rounded-lg p-1.5 transition-all ${
                            deletingId === conv.id
                              ? "cursor-not-allowed text-text-muted opacity-50"
                              : "text-text-muted hover:text-red-400"
                          }`}
                          title="Delete"
                        >
                          {deletingId === conv.id ? (
                            <svg
                              className="h-3 w-3 animate-spin"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <title>Deleting</title>
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <title>Delete</title>
                              <path
                                fillRule="evenodd"
                                d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
