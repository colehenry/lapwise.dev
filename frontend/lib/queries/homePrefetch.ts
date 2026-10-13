import { consoleAvailabilityQuery, consoleReplayQuery } from "./consoleReplay";
import { seconds } from "./durations";
import { headlinesQuery } from "./headlines";
import type { RequestOptions } from "./http";
import { replayTrackQuery } from "./replay";
import { prefetchForHydration } from "./server";
import { roundSessionQuery } from "./sessions";
import { seasonStandingsQuery } from "./standings";

/** Public data only: this snapshot is shared across homepage visitors. */
export function prefetchHomeForHydration() {
  return prefetchForHydration(
    async (client, signal) => {
      // The public page caches this whole snapshot for 60 seconds. Read current
      // API data on regeneration rather than layering a separate fetch cache.
      const options: RequestOptions = { cache: "no-store", signal };
      const availability = consoleAvailabilityQuery(options);
      await client.prefetchQuery(availability);
      const data = client.getQueryData(availability.queryKey);
      if (!data || signal.aborted) return [];

      const { season, latest, replay } = data;
      return [
        ...(replay ? [consoleReplayQuery(replay, options)] : []),
        ...(!replay && latest
          ? [replayTrackQuery(latest.circuit_id, options)]
          : []),
        ...(season !== null
          ? [
              seasonStandingsQuery(season, options),
              headlinesQuery(season, options),
            ]
          : []),
        ...(season !== null && latest
          ? [roundSessionQuery(season, latest.round, "race", 1, options)]
          : []),
      ];
    },
    { timeoutMs: seconds(2) },
  );
}
