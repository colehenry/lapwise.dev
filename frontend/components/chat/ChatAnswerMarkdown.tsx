"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEntityLinkColors } from "@/hooks/useEntityLinkColors";

const AIDataTable = dynamic(() => import("./AIDataTable"), {
  ssr: false,
  loading: () => (
    <div className="h-28 rounded-sm border border-line-soft bg-surface-panel" />
  ),
});

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

/**
 * One Clutch answer: markdown prose, entity-tinted links and delta tokens.
 *
 * `prose--streaming` rides a caret on the last line, so the answer shows it is
 * still arriving without a separate element that would reflow when it lands.
 */
export default function ChatAnswerMarkdown({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  const { driverColors, teamColors } = useEntityLinkColors();

  return (
    <div
      className={`prose prose--chat min-w-0 max-w-full text-[14.5px] text-ink-base md:text-[15px] ${
        isStreaming ? "prose--streaming" : ""
      }`}
    >
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
                  className="font-semibold transition-colors hover:text-accent-light"
                >
                  {renderDeltaChildren(children)}
                </a>
              );
            }

            return (
              <Link
                href={href}
                className="font-semibold no-underline transition-opacity hover:opacity-80"
                style={{ color: linkColor ?? "var(--ink-strong)" }}
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
            return <blockquote>{renderDeltaChildren(children)}</blockquote>;
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
              type ElWithChildren = ReactElement<{ children?: ReactNode }>;
              const theadRows = (thead as ElWithChildren)?.props?.children;
              const headerRow = Array.isArray(theadRows)
                ? theadRows[0]
                : theadRows;
              const ths = (headerRow as ElWithChildren)?.props?.children;
              for (const th of Array.isArray(ths) ? ths : [ths]) {
                headers.push((th as ElWithChildren)?.props?.children ?? "");
              }

              const tbodyRows = (tbody as ElWithChildren)?.props?.children;
              for (const tr of Array.isArray(tbodyRows)
                ? tbodyRows
                : [tbodyRows]) {
                const tds = (tr as ElWithChildren)?.props?.children;
                const row: ReactNode[] = [];
                for (const td of Array.isArray(tds) ? tds : [tds]) {
                  row.push((td as ElWithChildren)?.props?.children ?? "");
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
  );
}
