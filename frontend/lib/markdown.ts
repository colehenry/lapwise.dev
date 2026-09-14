const CODE_BLOCK_TOKEN = "@@CODEBLOCK";
const CLUTCH_ICON_TOKEN = ":clutch:";

const CLUTCH_ICON_HTML =
  '<span class="markdown-clutch-icon clutch-mark" role="img" aria-label="Clutch"></span>';

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

  html = html.replaceAll(CLUTCH_ICON_TOKEN, CLUTCH_ICON_HTML);

  return html;
}
