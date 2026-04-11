const CODE_BLOCK_TOKEN = "@@CODEBLOCK";
const CLUTCH_ICON_TOKEN = ":clutch:";

const CLUTCH_ICON_SVG =
  '<svg class="markdown-clutch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Clutch"><rect x="2" y="2" width="20" height="3" rx="0.6"></rect><path d="M6 5 L5.2 9"></path><path d="M12 5 L12 9"></path><path d="M17.2 5 L17.9 9"></path><path d="M3.7 9 H6.7 L7.1 14 H3.3 Z"></path><path d="M4.3 11.3 H6.5"></path><path d="M4.1 12.6 H6.7"></path><path d="M10.5 9 H13.5 L13.8 14 H10.2 Z"></path><path d="M10.9 11.3 H13.3"></path><path d="M10.8 12.6 H13.4"></path><path d="M16.4 9 H19.4 L19.9 20 H16.1 Z"></path><path d="M16.8 11.2 H19.1"></path><path d="M16.85 13 H19.2"></path><path d="M16.9 14.8 H19.25"></path><path d="M16.95 16.6 H19.3"></path><path d="M17 18.4 H19.35"></path></svg>';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyInlineFormatting(text: string): string {
  let formatted = text;

  // Inline code
  formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic (avoid bold already converted)
  formatted = formatted.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  // External links
  formatted = formatted.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>',
  );

  // Internal app links
  formatted = formatted.replace(
    /\[([^\]]+)\]\((\/(?!\/)[^)\s]+)\)/g,
    '<a href="$2">$1</a>',
  );

  return formatted;
}

export function markdownToHtml(raw: string): string {
  const codeBlocks: string[] = [];

  let text = raw.replace(/```([\s\S]*?)```/g, (_match, code) => {
    const cleaned = code.replace(/\n$/, "");
    const token = `${CODE_BLOCK_TOKEN}${codeBlocks.length}@@`;
    codeBlocks.push(escapeHtml(cleaned));
    return token;
  });

  text = escapeHtml(text);
  text = applyInlineFormatting(text);

  const lines = text.split(/\r?\n/);
  const output: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      output.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    if (trimmed.startsWith(CODE_BLOCK_TOKEN)) {
      closeList();
      output.push(trimmed);
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      output.push(`<h${level}>${headingMatch[2]}</h${level}>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (!inList) {
        output.push("<ul>");
        inList = true;
      }
      output.push(`<li>${trimmed.replace(/^[-*]\s+/, "")}</li>`);
      continue;
    }

    if (/^(?:&gt;|>)\s?/.test(trimmed)) {
      closeList();
      output.push(
        `<blockquote>${trimmed.replace(/^(?:&gt;|>)\s?/, "")}</blockquote>`,
      );
      continue;
    }

    closeList();
    output.push(`<p>${trimmed}</p>`);
  }

  closeList();

  let html = output.join("\n");

  html = html.replace(
    new RegExp(`${CODE_BLOCK_TOKEN}(\\d+)@@`, "g"),
    (_, idx) => {
      const code = codeBlocks[Number(idx)] ?? "";
      return `<pre><code>${code}</code></pre>`;
    },
  );

  html = html.replaceAll(CLUTCH_ICON_TOKEN, CLUTCH_ICON_SVG);

  return html;
}
