"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import UserAvatar from "@/components/comments/UserAvatar";
import ClutchIcon from "@/components/ui/ClutchIcon";
import { useEntityLinkColors } from "@/hooks/useEntityLinkColors";
import type { ChartConfig, StepType, ThinkingStep } from "@/lib/chat";

const AIChart = dynamic(() => import("./AIChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] rounded-sm border border-[var(--glass-border)] bg-[var(--glass-surface)]" />
  ),
});

const AIDataTable = dynamic(() => import("./AIDataTable"), {
  ssr: false,
  loading: () => (
    <div className="h-28 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-surface)]" />
  ),
});

interface ChatMessageProps {
  messageRole: "user" | "assistant";
  content: string;
  charts?: ChartConfig[];
  queries?: string[];
  steps?: ThinkingStep[];
  followUps?: string[];
  onFollowUp?: (question: string) => void;
  isLoading?: boolean;
  isStreaming?: boolean;
  statusText?: string | null;
  userName?: string;
  userAvatarUrl?: string | null;
  compact?: boolean;
}

const DELTA_TOKEN_PATTERN = /\{(?:g:([^}]+)|r:([^}]+)|(\+[^}:]+)|(-[^}:]+))\}/g;

function renderDeltaText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(DELTA_TOKEN_PATTERN)) {
    if (match.index === undefined) continue;
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const positive = match[1] ?? match[3];
    const negative = match[2] ?? match[4];
    parts.push(
      <span
        key={`${match.index}-${match[0]}`}
        className={positive ? "delta-positive" : "delta-negative"}
      >
        {positive ?? negative}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function renderDeltaChildren(children: ReactNode): ReactNode {
  return Array.isArray(children)
    ? children.map((child) => renderDeltaChildren(child))
    : typeof children === "string"
      ? renderDeltaText(children)
      : isValidElement<{ children?: ReactNode }>(children)
        ? cloneElement(children as ReactElement<{ children?: ReactNode }>, {
            children: renderDeltaChildren(children.props.children),
          })
        : children;
}

function StepIcon({ stepType }: { stepType: StepType }) {
  const cls = "h-3 w-3 shrink-0";
  switch (stepType) {
    case "sql":
      return (
        <svg
          className={cls}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 1C4.7 1 2 2.3 2 4v8c0 1.7 2.7 3 6 3s6-1.3 6-3V4c0-1.7-2.7-3-6-3zM8 3c2.8 0 4 .9 4 1s-1.2 1-4 1-4-.9-4-1 1.2-1 4-1zm4 9c0 .1-1.2 1-4 1s-4-.9-4-1V9.7c1 .5 2.4.8 4 .8s3-.3 4-.8V12zm0-4c0 .1-1.2 1-4 1s-4-.9-4-1V5.7c1 .5 2.4.8 4 .8s3-.3 4-.8V8z" />
        </svg>
      );
    case "schema":
    case "sample":
      return (
        <svg
          className={cls}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9zM3.5 3a.5.5 0 00-.5.5V6h10V3.5a.5.5 0 00-.5-.5h-9zM13 7H3v2h10V7zm0 3H3v2.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V10z" />
        </svg>
      );
    case "chart":
      return (
        <svg
          className={cls}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M1 14h14V2h-1v11H4V2H3v11H1v1zm3-7h2v6H4V7zm3-2h2v8H7V5zm3 4h2v4h-2V9z" />
        </svg>
      );
    case "synthesizing":
      return (
        <svg
          className={cls}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M4.5 2A2.5 2.5 0 002 4.5v2.879a2.5 2.5 0 00.732 1.767l4.5 4.5a2.5 2.5 0 003.536 0l2.879-2.879a2.5 2.5 0 000-3.536l-4.5-4.5A2.5 2.5 0 007.38 2H4.5zM5 6a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      );
    default:
      return (
        <svg
          className={cls}
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 1a5 5 0 11-.001 10.001A5 5 0 018 3zm-.5 2.5a.5.5 0 011 0v3a.5.5 0 01-.5.5H6a.5.5 0 010-1h1.5v-2.5z" />
        </svg>
      );
  }
}

function ThinkingSteps({
  steps,
  isStreaming,
}: {
  steps: ThinkingStep[];
  isStreaming?: boolean;
}) {
  const [expanded, setExpanded] = useState(isStreaming ?? false);

  useEffect(() => {
    if (isStreaming) {
      setExpanded(true);
    } else if (steps.length > 0) {
      const timer = setTimeout(() => setExpanded(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, steps.length]);

  if (steps.length === 0) return null;

  const duration =
    steps.length >= 2
      ? (
          (steps[steps.length - 1].timestamp - steps[0].timestamp) /
          1000
        ).toFixed(1)
      : null;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-tertiary transition-colors"
      >
        {isStreaming ? (
          <svg
            className="h-3 w-3 animate-spin text-purple-400"
            viewBox="0 0 24 24"
            fill="none"
          >
            <title>Working</title>
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
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <title>Toggle</title>
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
        )}
        <span>
          {isStreaming
            ? steps[steps.length - 1].message
            : `${steps.length} step${steps.length === 1 ? "" : "s"}${duration ? ` · ${duration}s` : ""}`}
        </span>
      </button>
      {expanded && !isStreaming && (
        <div className="mt-1.5 ml-1 space-y-1 border-l border-white/[0.06] pl-3">
          {steps.map((step, i) => (
            <div
              key={`${step.stepType}-${i}`}
              className="flex items-center gap-2 text-[11px] text-text-muted"
            >
              <StepIcon stepType={step.stepType} />
              <span>{step.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AIAnalystAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div
      className={`flex ${dim} items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-300`}
    >
      <ClutchIcon className={icon} />
    </div>
  );
}

export default function ChatMessage({
  messageRole,
  content,
  charts,
  queries,
  steps,
  followUps,
  onFollowUp,
  isLoading,
  isStreaming,
  statusText,
  userName,
  userAvatarUrl,
  compact,
}: ChatMessageProps) {
  const { driverColors, teamColors } = useEntityLinkColors();
  const [showSQL, setShowSQL] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  }
  const isUser = messageRole === "user";
  const avatarSize = compact ? "sm" : "md";
  if (isLoading) {
    return (
      <div className="flex min-w-0 max-w-full gap-3 py-3">
        <AIAnalystAvatar size={avatarSize} />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="w-full max-w-full rounded-2xl border border-[var(--message-assistant-border)] bg-[var(--message-assistant-bg)] px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <svg
                className="animate-spin h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <title>Thinking</title>
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {statusText || "Analyzing..."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-w-0 max-w-full gap-0 py-2 md:gap-3 md:py-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div className="hidden shrink-0 pt-0.5 sm:block">
        {isUser ? (
          <UserAvatar
            username={userName || "You"}
            avatarUrl={userAvatarUrl}
            size={compact ? "sm" : "md"}
            className="rounded-xl"
          />
        ) : (
          <AIAnalystAvatar size={avatarSize} />
        )}
      </div>

      <div
        className={`min-w-0 flex-1 overflow-hidden ${isUser ? "text-right" : ""}`}
      >
        {isUser ? (
          <div className="inline-block w-fit max-w-[min(90%,calc(100vw-2rem))] whitespace-pre-wrap break-words rounded-xl border border-[var(--message-user-border)] bg-[var(--message-user-bg)] px-3 py-2 text-left text-xs leading-relaxed text-text-primary md:max-w-[85%] md:rounded-2xl md:px-4 md:py-2.5 md:text-sm">
            {content}
          </div>
        ) : (
          <div className="w-full min-w-0 max-w-full space-y-2 overflow-hidden rounded-xl border border-[var(--message-assistant-border)] bg-[var(--message-assistant-bg)] px-3 py-2.5 md:rounded-2xl md:px-5 md:py-3">
            {steps && steps.length > 0 && (
              <ThinkingSteps steps={steps} isStreaming={isStreaming} />
            )}

            {statusText && (!steps || steps.length === 0) && (
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/15 bg-purple-500/[0.06] px-3 py-1 text-[11px] text-purple-300">
                <svg
                  className="h-3 w-3 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <title>Working</title>
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
                {statusText}
              </div>
            )}

            {content && (
              <div className="prose-chat min-w-0 max-w-full text-xs leading-relaxed text-text-secondary md:text-sm">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a({ href, children }) {
                      if (!href) return <span>{children}</span>;
                      const isInternal = href.startsWith("/");
                      const driverCode = href.startsWith("/drivers/")
                        ? decodeURIComponent(href.replace("/drivers/", ""))
                        : null;
                      const teamName = href.startsWith("/constructors/")
                        ? decodeURIComponent(href.replace("/constructors/", ""))
                        : null;
                      const linkColor =
                        (driverCode ? driverColors.get(driverCode) : null) ??
                        (teamName ? teamColors.get(teamName) : null) ??
                        null;

                      if (!isInternal) {
                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="font-semibold transition-colors hover:text-purple-200"
                          >
                            {renderDeltaChildren(children)}
                          </a>
                        );
                      }

                      return (
                        <Link
                          href={href}
                          className="font-semibold no-underline transition-opacity hover:opacity-80"
                          style={{ color: linkColor ?? "var(--text-primary)" }}
                        >
                          {renderDeltaChildren(children)}
                        </Link>
                      );
                    },
                    p({ children }) {
                      return <p>{renderDeltaChildren(children)}</p>;
                    },
                    li({ children }) {
                      return <li>{renderDeltaChildren(children)}</li>;
                    },
                    strong({ children }) {
                      return <strong>{renderDeltaChildren(children)}</strong>;
                    },
                    em({ children }) {
                      return <em>{renderDeltaChildren(children)}</em>;
                    },
                    blockquote({ children }) {
                      return (
                        <blockquote>{renderDeltaChildren(children)}</blockquote>
                      );
                    },
                    h1({ children }) {
                      return <h1>{renderDeltaChildren(children)}</h1>;
                    },
                    h2({ children }) {
                      return <h2>{renderDeltaChildren(children)}</h2>;
                    },
                    h3({ children }) {
                      return <h3>{renderDeltaChildren(children)}</h3>;
                    },
                    h4({ children }) {
                      return <h4>{renderDeltaChildren(children)}</h4>;
                    },
                    th({ children }) {
                      return <th>{renderDeltaChildren(children)}</th>;
                    },
                    td({ children }) {
                      return <td>{renderDeltaChildren(children)}</td>;
                    },
                    table({ children }) {
                      const thead = (children as ReactElement[])?.find?.(
                        (c: ReactElement) => c?.type === "thead",
                      );
                      const tbody = (children as ReactElement[])?.find?.(
                        (c: ReactElement) => c?.type === "tbody",
                      );

                      const headers: ReactNode[] = [];
                      const rows: ReactNode[][] = [];

                      try {
                        type ElWithChildren = ReactElement<{
                          children?: ReactNode;
                        }>;
                        const theadRows = (thead as ElWithChildren)?.props
                          ?.children;
                        const headerRow = Array.isArray(theadRows)
                          ? theadRows[0]
                          : theadRows;
                        const ths = (headerRow as ElWithChildren)?.props
                          ?.children;
                        for (const th of Array.isArray(ths) ? ths : [ths]) {
                          headers.push(
                            (th as ElWithChildren)?.props?.children ?? "",
                          );
                        }

                        const tbodyRows = (tbody as ElWithChildren)?.props
                          ?.children;
                        for (const tr of Array.isArray(tbodyRows)
                          ? tbodyRows
                          : [tbodyRows]) {
                          const tds = (tr as ElWithChildren)?.props?.children;
                          const row: ReactNode[] = [];
                          for (const td of Array.isArray(tds) ? tds : [tds]) {
                            row.push(
                              (td as ElWithChildren)?.props?.children ?? "",
                            );
                          }
                          rows.push(row);
                        }

                        if (headers.length > 0 && rows.length > 0) {
                          return <AIDataTable headers={headers} rows={rows} />;
                        }
                      } catch {
                        // fall through to default
                      }
                      return <table>{children}</table>;
                    },
                  }}
                >
                  {content}
                </Markdown>
              </div>
            )}

            {charts && charts.length > 0 && (
              <div className="min-w-0 max-w-full space-y-3 overflow-hidden">
                {charts.map((chart, i) => (
                  <AIChart key={`chart-${chart.title}-${i}`} config={chart} />
                ))}
              </div>
            )}

            {queries && queries.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowSQL(!showSQL)}
                  className="text-[11px] text-text-muted hover:text-text-tertiary transition-colors flex items-center gap-1"
                >
                  <svg
                    className={`h-3 w-3 transition-transform ${showSQL ? "rotate-90" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <title>Toggle</title>
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {queries.length} SQL{" "}
                  {queries.length === 1 ? "query" : "queries"} executed
                </button>
                {showSQL && (
                  <div className="mt-2 space-y-2">
                    {queries.map((sql) => (
                      <pre
                        key={sql}
                        className="rounded-lg border border-[var(--message-query-border)] bg-[var(--message-query-bg)] p-3 text-xs text-text-tertiary font-mono whitespace-pre-wrap break-words"
                      >
                        {sql}
                      </pre>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isStreaming && content && (
              <div className="flex items-center justify-between pt-1">
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {followUps &&
                    followUps.length > 0 &&
                    onFollowUp &&
                    followUps.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onFollowUp(q)}
                        className="max-w-full break-words rounded-full border border-purple-500/20 bg-purple-500/[0.06] px-2.5 py-1 text-left text-[11px] text-purple-300 transition-all hover:border-purple-500/30 hover:bg-purple-500/10"
                      >
                        {q}
                      </button>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="ml-2 shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:text-text-secondary"
                  title="Copy response"
                >
                  {copied ? (
                    <svg
                      className="h-3.5 w-3.5 text-green-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <title>Copied</title>
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <title>Copy</title>
                      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
