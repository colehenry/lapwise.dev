import { markdownToHtml } from "@/lib/markdown";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export default function MarkdownContent({
  content,
  className = "",
}: MarkdownContentProps) {
  const html = markdownToHtml(content);

  return (
    <div
      className={`markdown-content ${className}`}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: markdownToHtml escapes HTML and only emits a limited safe subset.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
