export function normalizeQuestionText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function extractSeason(question: string): number | null {
  const match = question.match(/\b(19[5-9]\d|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

export function extractTopLimit(
  question: string,
  fallback: number,
  maximum: number,
): number {
  const match = normalizeQuestionText(question).match(
    /\btop (\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/,
  );
  if (!match) return fallback;
  const parsed = Number(match[1]) || NUMBER_WORDS[match[1]] || fallback;
  return Math.min(Math.max(parsed, 1), maximum);
}
