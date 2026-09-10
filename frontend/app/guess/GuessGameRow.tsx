import type { CSSProperties, ReactNode } from "react";
import DriverHeadshot from "@/components/entities/DriverHeadshot";
import { getDriverHeadshotUrl } from "@/lib/entityImageOverrides";
import type {
  GuessGameComparison,
  GuessGameResult,
} from "@/lib/queries/guessGame";

const YELLOW = {
  country: "Yellow means the countries are on the same continent.",
  debut: "Yellow means the debut years are within three seasons.",
  last_raced: "Yellow means the final seasons are within three years.",
  constructor:
    "Yellow means their constructor histories overlap, possibly in different seasons and not as teammates.",
  career_peak: "Yellow means the career peaks are one achievement level apart.",
} as const;

function Clue({
  category,
  comparison,
  label,
  value,
  year = false,
  highContrast,
}: {
  category: keyof typeof YELLOW;
  comparison: GuessGameComparison;
  label: string;
  value: ReactNode;
  year?: boolean;
  highContrast: boolean;
}) {
  const arrow =
    comparison.direction === "higher"
      ? "↑"
      : comparison.direction === "lower"
        ? "↓"
        : "";
  const close = comparison.state === "close";
  return (
    <div
      tabIndex={close ? 0 : undefined}
      data-tooltip={close ? YELLOW[category] : undefined}
      className={`game-clue game-clue--${comparison.state} ${
        highContrast ? "saturate-150 contrast-125" : ""
      }`}
    >
      <span className="text-[11px] leading-[1.1]">{label}</span>
      {close && <span className="sr-only">{YELLOW[category]}</span>}
      <span
        className={`mt-[5px] items-baseline justify-center ${
          year ? "grid grid-cols-[14px_auto_14px]" : "flex"
        }`}
      >
        {year && <span aria-hidden="true" />}
        <strong className="text-[16px] leading-[1.05]">{value}</strong>
        {year && (
          <span className="text-right text-xs text-white/80">{arrow}</span>
        )}
      </span>
    </div>
  );
}

export default function GuessGameRow({
  guess,
  highContrast,
  reduceMotion,
}: {
  guess: GuessGameResult;
  highContrast: boolean;
  reduceMotion: boolean;
}) {
  const color = guess.fact.constructor_color;
  return (
    <article
      className={`relative ${
        reduceMotion ? "" : "motion-safe:animate-[fadeIn_160ms_ease-out]"
      }`}
    >
      <div className="mx-auto w-[370px] max-w-full">
        <div className="flex min-h-[58px] items-center gap-[13px]">
          <DriverHeadshot
            code={guess.driver.driver_code}
            fullName={guess.driver.full_name}
            size={58}
            shape="circle"
            src={getDriverHeadshotUrl(guess.driver)}
            focalX={guess.driver.media?.focal_x}
            focalY={guess.driver.media?.focal_y}
          />
          <div>
            <div className="flex items-center gap-[7px]">
              <span className="text-[21px] font-bold leading-[1.1] text-ink-strong">
                {guess.driver.full_name}
              </span>
              {guess.correct && (
                <span
                  className="text-[17px] leading-none"
                  role="img"
                  aria-label="Correct"
                >
                  🏆
                </span>
              )}
            </div>
            <div className="mt-[5px] font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
              {guess.driver.driver_code}
            </div>
          </div>
        </div>
        <div className="mt-[13px] grid grid-cols-6 gap-[7px]">
          <Clue
            category="debut"
            label="Debut"
            value={guess.values.debut}
            comparison={guess.comparisons.debut}
            year
            highContrast={highContrast}
          />
          <Clue
            category="last_raced"
            label="Last raced"
            value={guess.values.last_raced}
            comparison={guess.comparisons.last_raced}
            year
            highContrast={highContrast}
          />
          <Clue
            category="country"
            label="Country"
            value={guess.values.country}
            comparison={guess.comparisons.country}
            highContrast={highContrast}
          />
          <Clue
            category="constructor"
            label="Constructor"
            value={guess.values.constructor}
            comparison={guess.comparisons.constructor}
            highContrast={highContrast}
          />
          <Clue
            category="career_peak"
            label="Career peak"
            value={guess.values.career_peak}
            comparison={guess.comparisons.career_peak}
            highContrast={highContrast}
          />
        </div>
      </div>
      <aside
        className="absolute left-[calc(50%+213px)] top-2 w-[260px] border-l border-line-strong pl-5 max-[760px]:static max-[760px]:mt-[13px] max-[760px]:w-auto"
        style={
          {
            "--driver-color": color ? `#${color}` : "var(--ink-base)",
          } as CSSProperties
        }
      >
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--driver-color)]">
          Driver Fact
        </span>
        <p className="mt-[7px] text-[13px] leading-[1.45] text-ink-base">
          {guess.fact.text}
        </p>
        {guess.correct && guess.highlights && (
          <div className="mt-[13px] grid gap-[7px]">
            {guess.highlights.map((highlight) => (
              <div key={highlight.id} className="text-xs text-ink-soft">
                <strong className="mr-[5px] text-sm text-ink-strong">
                  {highlight.value}
                </strong>
                <span>{highlight.label}</span>
              </div>
            ))}
          </div>
        )}
      </aside>
    </article>
  );
}
