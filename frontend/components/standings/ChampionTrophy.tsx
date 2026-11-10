import type {
  ConstructorStanding,
  DriverStanding,
} from "@/lib/championshipTypes";

/**
 * Marks the entrant who clinched the title, beside their name.
 *
 * The round it was settled lives in the points breakdown rather than here: in
 * a list read top to bottom, one glyph is the whole signal, and a line of text
 * would make this row taller than every other.
 */
export default function ChampionTrophy({
  entrant,
}: {
  entrant: DriverStanding | ConstructorStanding;
}) {
  if (typeof entrant.clinched_round !== "number") return null;
  return (
    <span
      role="img"
      aria-label={`Champion, clinched round ${entrant.clinched_round}`}
      title={`Clinched R${entrant.clinched_round}`}
      className="ml-1.5 align-middle text-xs"
    >
      🏆
    </span>
  );
}
