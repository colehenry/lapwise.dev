"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border-primary flex items-center justify-between">
        <h3 className="text-text-primary font-mono text-sm font-bold uppercase tracking-wide">
          Conversations
        </h3>
        <button
          type="button"
          onClick={onNew}
          className="text-purple-400 hover:text-purple-300 text-xs font-medium transition-colors"
        >
          + New
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-text-muted text-xs text-center">
            No conversations yet
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => {
                  onSelect(conv.id);
                  onClose();
                }}
                className={`w-full text-left px-3 py-2.5 rounded-sm text-sm transition-colors group relative ${
                  activeId === conv.id
                    ? "bg-purple-500/15 text-purple-300 border border-purple-500/20"
                    : "text-text-secondary hover:bg-bg-elevated"
                }`}
              >
                <div className="truncate pr-6 font-medium text-xs">
                  {conv.title || "Untitled"}
                </div>
                <div className="text-text-muted text-[10px] mt-0.5">
                  {formatDistanceToNow(new Date(conv.updated_at), {
                    addSuffix: true,
                  })}
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, conv.id)}
                  onBlur={() => setConfirmDelete(null)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
                    confirmDelete === conv.id
                      ? "text-red-400 hover:text-red-300"
                      : "text-text-muted hover:text-text-tertiary opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
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
      {/* Desktop sidebar */}
      <div className="hidden md:block w-64 border-r border-border-primary bg-bg-tertiary shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={onClose}
            onKeyDown={() => {}}
            role="presentation"
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-bg-tertiary z-50 md:hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border-primary">
              <h3 className="text-text-primary font-mono text-sm font-bold uppercase">
                Conversations
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-text-muted hover:text-text-primary p-1"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
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
