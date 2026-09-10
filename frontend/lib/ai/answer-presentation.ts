export interface EntityReference {
  name: string;
  href: string;
}

function isInternalEntityHref(href: string): boolean {
  return /^\/(drivers|constructors|circuits|results)\//.test(href);
}

export function collectEntityReferences(value: unknown): EntityReference[] {
  const references: EntityReference[] = [];

  function visit(candidate: unknown): void {
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    if (!candidate || typeof candidate !== "object") return;

    const record = candidate as Record<string, unknown>;
    if (
      typeof record.name === "string" &&
      typeof record.href === "string" &&
      isInternalEntityHref(record.href)
    ) {
      references.push({ name: record.name, href: record.href });
    }
    for (const child of Object.values(record)) visit(child);
  }

  visit(value);
  return references;
}

export function presentAgentAnswer(
  answer: string,
  references: EntityReference[],
): string {
  const uniqueReferences = [
    ...new Map(
      references.map((reference) => [
        `${reference.name}\u0000${reference.href}`,
        reference,
      ]),
    ).values(),
  ].sort((left, right) => right.name.length - left.name.length);

  let markdown = answer.trim();
  for (const reference of uniqueReferences) {
    if (markdown.includes(`[${reference.name}](`)) continue;
    const index = markdown.indexOf(reference.name);
    if (index === -1) continue;
    markdown = `${markdown.slice(0, index)}[${reference.name}](${reference.href})${markdown.slice(index + reference.name.length)}`;
  }
  return markdown;
}
