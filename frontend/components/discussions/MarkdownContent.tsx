"use client";

import {
  DiscussionEmbed,
  type DiscussionEmbedAttrs,
} from "@/components/discussions/DiscussionEmbeds";
import { markdownToHtml } from "@/lib/markdown";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

type MarkdownBlock = {
  id: string;
  type: "markdown";
  content: string;
};

type EmbedBlock = {
  id: string;
  type: "embed";
  kind: "lapwise-chart" | "lapwise-table";
  attrs: DiscussionEmbedAttrs;
};

type ContentBlock = MarkdownBlock | EmbedBlock;

const EMBED_PATTERN = /^::(lapwise-chart|lapwise-table)\{([^}]*)\}\s*$/;

function parseAttrs(raw: string): DiscussionEmbedAttrs {
  const attrs: DiscussionEmbedAttrs = {};
  const attrPattern = /(\w+)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;

  for (const match of raw.matchAll(attrPattern)) {
    const key = match[1] as keyof DiscussionEmbedAttrs;
    attrs[key] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attrs;
}

function parseBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const markdownLines: string[] = [];
  let blockId = 0;

  const flushMarkdown = () => {
    const markdown = markdownLines.join("\n").trim();
    if (markdown) {
      blocks.push({
        id: `markdown-${blockId}`,
        type: "markdown",
        content: markdown,
      });
      blockId += 1;
    }
    markdownLines.length = 0;
  };

  for (const line of content.split(/\r?\n/)) {
    const embedMatch = EMBED_PATTERN.exec(line.trim());
    if (!embedMatch) {
      markdownLines.push(line);
      continue;
    }

    flushMarkdown();
    blocks.push({
      id: `embed-${blockId}`,
      type: "embed",
      kind: embedMatch[1] as "lapwise-chart" | "lapwise-table",
      attrs: parseAttrs(embedMatch[2]),
    });
    blockId += 1;
  }

  flushMarkdown();
  return blocks;
}

export function stripLapwiseEmbeds(content: string): string {
  return content
    .split(/\r?\n/)
    .filter((line) => !EMBED_PATTERN.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function MarkdownContent({
  content,
  className = "",
}: MarkdownContentProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={`markdown-content ${className}`}>
      {blocks.map((block) => {
        if (block.type === "embed") {
          return (
            <DiscussionEmbed
              key={block.id}
              kind={block.kind}
              attrs={block.attrs}
            />
          );
        }

        const html = markdownToHtml(block.content);
        return (
          <div
            key={block.id}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: markdownToHtml escapes HTML and only emits a limited safe subset.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}
