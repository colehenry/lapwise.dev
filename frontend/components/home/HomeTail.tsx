import EntryTiles from "./EntryTiles";
import NextRaceCard from "./NextRaceCard";
import RecentRaces from "./RecentRaces";

export default function HomeTail({
  season,
  round,
  circuitName,
}: {
  season: number | null;
  round: number | null;
  circuitName: string | null;
}) {
  return (
    <div className="page-frame grid gap-3 py-3">
      <div className="home-races-row">
        <NextRaceCard />
        <RecentRaces season={season} />
      </div>
      <EntryTiles season={season} round={round} circuitName={circuitName} />
    </div>
  );
}
