export interface F1GlossaryFragment {
  text: string;
  term: string | null;
  definition: string | null;
  start: number;
}

const DEFINITIONS = {
  undercut:
    "An undercut means pitting before the car ahead and trying to use newer tyres to get past them.",
  overcut:
    "An overcut means staying out longer than the car ahead and trying to gain the position before or during your later stop.",
  "double-stack":
    "A double-stack is when a team pits both of its cars one after the other on the same lap.",
  "pit window":
    "A pit window is the range of laps when a driver can stop and rejoin in a useful track position.",
  stint:
    "A stint is the run of laps a driver completes between pit stops on one set of tyres.",
  "virtual safety car":
    "A Virtual Safety Car makes every driver slow to a controlled pace without bunching the field behind a physical Safety Car.",
  vsc: "VSC means Virtual Safety Car: every driver must slow to a controlled pace while the hazard is cleared.",
  "safety car":
    "A Safety Car slows the race and gathers the cars together while a hazard is cleared.",
  drs: "DRS is a movable rear-wing flap that reduces drag in permitted zones, helping a following car attempt a pass.",
  "dirty air":
    "Dirty air is the disturbed airflow behind another car, which can reduce grip for the following driver.",
  "out-lap": "An out-lap is the first lap after a driver leaves the pits.",
  "in-lap": "An in-lap is the lap on which a driver enters the pits.",
} as const;

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TERMS = Object.keys(DEFINITIONS).sort(
  (left, right) => right.length - left.length,
);
const TERM_PATTERN = new RegExp(
  `\\b(${TERMS.map(escapePattern).join("|")})\\b`,
  "gi",
);

export function splitF1GlossaryText(text: string): F1GlossaryFragment[] {
  const fragments: F1GlossaryFragment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(TERM_PATTERN)) {
    if (match.index === undefined) continue;
    if (match.index > lastIndex) {
      fragments.push({
        text: text.slice(lastIndex, match.index),
        term: null,
        definition: null,
        start: lastIndex,
      });
    }
    const matchedText = match[0];
    const term = matchedText.toLowerCase() as keyof typeof DEFINITIONS;
    fragments.push({
      text: matchedText,
      term,
      definition: DEFINITIONS[term],
      start: match.index,
    });
    lastIndex = match.index + matchedText.length;
  }
  if (lastIndex < text.length) {
    fragments.push({
      text: text.slice(lastIndex),
      term: null,
      definition: null,
      start: lastIndex,
    });
  }
  return fragments.length > 0
    ? fragments
    : [{ text, term: null, definition: null, start: 0 }];
}
