"use client";

import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { ChatConversation } from "@/lib/chat";

interface ConversationSidebarProps {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onClose,
}: ConversationSidebarProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (confirmDelete === id) {
      onDelete(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-primary px-4 py-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-text-primary">
            Chat History
          </h3>
          <p className="mt-1 text-[11px] text-text-muted">
            Jump between past analyses
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-purple-300 transition-colors hover:border-purple-500/40 hover:text-purple-200"
        >
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">
            No conversations yet
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => {
                  onSelect(conv.id);
                  onClose();
                }}
                className={`group relative w-full rounded-2xl border px-3 py-3 text-left text-sm transition-colors ${
                  activeId === conv.id
                    ? "border-purple-500/30 bg-purple-500/12 text-purple-200 shadow-[inset_0_0_16px_rgba(160,32,240,0.08)]"
                    : "border-transparent text-text-secondary hover:border-border-primary hover:bg-bg-elevated"
                }`}
              >
                <div className="truncate pr-8 text-sm font-medium">
                  {conv.title || "Untitled"}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-text-muted">
                  {formatDistanceToNow(new Date(conv.updated_at), {
                    addSuffix: true,
                  })}
                </div>

                <button
                  type="button"
                  onClick={(e) => handleDelete(e, conv.id)}
                  onBlur={() => setConfirmDelete(null)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition-colors ${
                    confirmDelete === conv.id
                      ? "text-red-400 hover:text-red-300"
                      : "text-text-muted opacity-0 hover:text-text-tertiary group-hover:opacity-100"
                  }`}
                >
                  <svg
                    className="h-3.5 w-3.5"
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
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden w-80 shrink-0 lg:block">
        <div className="sticky top-24 h-[calc(100vh-7rem)] overflow-hidden rounded-[28px] border border-border-primary bg-bg-primary/78 shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          {sidebarContent}
        </div>
      </div>

      <div className="hidden md:block lg:hidden" />

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 z-50 w-80 max-w-[90vw] border-l border-border-primary bg-bg-tertiary shadow-xl lg:hidden">
            <div className="flex items-center justify-between border-b border-border-primary p-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-primary">
                Chat History
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-text-muted hover:text-text-primary"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <title>Close</title>
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-57px)]">{sidebarContent}</div>
          </div>
        </>
      )}
    </>
  );
}
