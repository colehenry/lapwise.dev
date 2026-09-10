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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (deletingId === id) return;
    onDelete(id);
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
    <aside
      id="conversation-history"
      aria-label="Conversation history"
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={`absolute inset-y-0 right-0 z-10 min-h-0 w-72 overflow-hidden border-l border-line-soft bg-surface-panel transition-transform duration-200 ease-out ${
        isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
      }`}
    >
      <div className="flex h-full min-h-0 w-72 flex-col">
        {/* Header */}
        <div className="flex flex-none items-center justify-between gap-2.5 border-b border-line-soft px-3 py-[9px]">
          <h3 className="m-0 text-[14px] font-bold tracking-[-0.01em] text-ink-strong">
            History
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onNew();
                onClose();
              }}
              className="rounded-sm border border-line-soft px-2.5 py-1 text-[12px] text-ink-soft transition-colors hover:border-accent hover:text-ink-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
            >
              New
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm p-1.5 text-ink-faint transition-colors hover:text-ink-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-bright"
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
            <div className="px-3 py-6">
              <p className="m-0 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                No conversations
              </p>
              <p className="m-0 mt-1.5 text-[12.5px] leading-[1.5] text-ink-soft">
                Ask something and it is kept here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line-soft">
              {conversations.map((conv) => (
                <div key={conv.id} className="group relative overflow-hidden">
                  {editingId === conv.id ? (
                    <div className="border-l-2 border-accent bg-surface-raised px-3 py-2.5">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, conv.id)}
                        onBlur={() => commitEdit(conv.id)}
                        ref={(el) => el?.focus()}
                        className="w-full rounded-sm border border-line-strong bg-surface-page px-1.5 py-0.5 text-[12.5px] text-ink-strong outline-none focus:border-accent"
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
                        className={`w-full border-l-2 px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-bright ${
                          activeId === conv.id || pendingId === conv.id
                            ? "border-accent bg-surface-raised text-ink-strong"
                            : "border-transparent text-ink-soft hover:bg-surface-raised hover:text-ink-base"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 pr-14">
                          {pendingId === conv.id && (
                            <svg
                              className="h-3 w-3 shrink-0 animate-spin text-accent-bright"
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
                          <span className="truncate text-[13px] leading-snug">
                            {conv.title || "Untitled"}
                          </span>
                        </div>
                        <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint tabular-nums">
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
                            className="rounded-sm p-1.5 text-ink-faint transition-colors hover:text-ink-base"
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
                          disabled={deletingId === conv.id}
                          className={`rounded-sm p-1.5 transition-colors ${
                            deletingId === conv.id
                              ? "cursor-not-allowed text-ink-faint opacity-50"
                              : "text-ink-faint hover:text-danger-bright"
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
    </aside>
  );
}
