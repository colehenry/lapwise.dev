const RULES = [
  [
    "Debut",
    "Green is the same debut year, yellow is within three years, and the arrow points toward the answer.",
  ],
  [
    "Last raced",
    "Green is the same final season, yellow is within three years, and the arrow points toward the answer.",
  ],
  [
    "Country",
    "Green is the same country and yellow is another country on the same continent.",
  ],
  [
    "Constructor",
    "A driver's signature constructor is where they earned the most wins, then podiums, then starts; green matches it, while yellow means their constructor histories overlap elsewhere, possibly in different seasons and not as teammates.",
  ],
  [
    "Career peak",
    "Champion, winner, podium, points, and starter form the levels; green is the same level and yellow is an adjacent one.",
  ],
] as const;

export default function GuessGameRules() {
  return (
    <ul className="m-0 grid gap-3 px-[18px] pb-[18px] pl-[31px] pt-[15px] text-[13px] leading-[1.4] text-ink-soft">
      {RULES.map(([label, text]) => (
        <li key={label}>
          <strong className="text-ink-strong">{label}:</strong> {text}
        </li>
      ))}
    </ul>
  );
}
