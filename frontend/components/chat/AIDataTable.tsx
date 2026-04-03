"use client";

import type React from "react";
import { useState } from "react";

interface AIDataTableProps {
  headers: React.ReactNode[];
  rows: React.ReactNode[][];
}

/** Extract a sort key string from any React node tree. */
function nodeToSortKey(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToSortKey).join("");
  if (node !== null && typeof node === "object" && "props" in node) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    return nodeToSortKey(el.props.children);
  }
  return "";
}

export default function AIDataTable({ headers, rows }: AIDataTableProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  function handleSort(col: number) {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  }

  const sortedRows =
    sortCol === null
      ? rows
      : [...rows].sort((a, b) => {
          const av = nodeToSortKey(a[sortCol] ?? "");
          const bv = nodeToSortKey(b[sortCol] ?? "");
          const an = Number.parseFloat(av.replace(/[^0-9.-]/g, ""));
          const bn = Number.parseFloat(bv.replace(/[^0-9.-]/g, ""));
          const cmp =
            !Number.isNaN(an) && !Number.isNaN(bn)
              ? an - bn
              : av.localeCompare(bv);
          return sortAsc ? cmp : -cmp;
        });

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.03]">
            {headers.map((h, i) => (
              <th
                key={nodeToSortKey(h) || String(i)}
                className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted cursor-pointer select-none hover:text-text-secondary transition-colors"
                onClick={() => handleSort(i)}
              >
                <span className="flex items-center gap-1">
                  {h}
                  {sortCol === i ? (
                    <svg
                      className="h-3 w-3 shrink-0"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      {sortAsc ? (
                        <path
                          fillRule="evenodd"
                          d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                          clipRule="evenodd"
                        />
                      ) : (
                        <path
                          fillRule="evenodd"
                          d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                          clipRule="evenodd"
                        />
                      )}
                    </svg>
                  ) : (
                    <svg
                      className="h-3 w-3 shrink-0 opacity-30"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2.24 6.8a.75.75 0 001.06-.04l1.95-2.1v8.59a.75.75 0 001.5 0V4.66l1.95 2.1a.75.75 0 101.1-1.02L7.8 3.13a.75.75 0 00-1.1 0L4.18 5.74a.75.75 0 00.06 1.06zm10.96 6.4a.75.75 0 10-1.06.04l-1.95 2.1V6.75a.75.75 0 00-1.5 0v8.59l-1.95-2.1a.75.75 0 10-1.1 1.02l2.01 2.16a.75.75 0 001.1 0l2.01-2.16a.75.75 0 00.44-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={row.map(nodeToSortKey).join("||")}
              className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
            >
              {row.map((cell, ci) => (
                <td
                  key={`${nodeToSortKey(headers[ci]) || ci}-${nodeToSortKey(cell)}`}
                  className="px-3 py-2 text-text-secondary"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
