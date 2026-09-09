import type { AnswerArtifact } from "./analysis-contracts";

function escapeCell(value: unknown): string {
  return String(value ?? "—")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

export function renderArtifactMarkdown(artifact: AnswerArtifact): string {
  const sections = [`## ${artifact.title}`, artifact.summary];

  if (artifact.metrics.length > 0) {
    sections.push(
      [
        "### Key metrics",
        ...artifact.metrics.map(
          (metric) => `- **${metric.label}:** ${metric.displayValue}`,
        ),
      ].join("\n"),
    );
  }

  for (const table of artifact.tables) {
    const header = `| ${table.columns.map((column) => column.label).join(" | ")} |`;
    const divider = `| ${table.columns.map(() => "---").join(" | ")} |`;
    const rows = table.rows.map(
      (row) =>
        `| ${table.columns.map((column) => escapeCell(row[column.key])).join(" | ")} |`,
    );
    sections.push(
      `### ${table.title}\n${[header, divider, ...rows].join("\n")}`,
    );
  }

  if (artifact.caveats.length > 0) {
    sections.push(
      [
        "### Coverage notes",
        ...artifact.caveats.map((note) => `- ${note}`),
      ].join("\n"),
    );
  }

  if (artifact.actions?.length) {
    sections.push(
      [
        "### Continue in Lapwise",
        ...artifact.actions.map(
          (action) => `- [${action.label}](${action.href})`,
        ),
      ].join("\n"),
    );
  }

  sections.push(
    `*Evidence: ${artifact.evidence.map((record) => record.label).join("; ")}.*`,
  );
  return sections.join("\n\n");
}
