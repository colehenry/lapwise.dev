/**
 * Circuit coordinates for the season globe.
 *
 * TODO(DB-12): `circuits.latitude` / `circuits.longitude` already exist on the
 * Circuit model but are NULL for all rows, so the API cannot serve them yet.
 * Backfill those columns in the ingest pipeline, expose them on the circuits
 * response, and delete this file — domain data belongs in the DB, not here.
 *
 * Keyed by `circuit_id` and verified against the API's own circuit names.
 */

type Coord = { name: string; lat: number; lon: number };

const CIRCUIT_COORDS: Record<number, Coord> = {
  1: { name: "Melbourne", lat: -37.8497, lon: 144.968 },
  2: { name: "Shanghai", lat: 31.3389, lon: 121.22 },
  3: { name: "Suzuka", lat: 34.8431, lon: 136.541 },
  4: { name: "Sakhir", lat: 26.0325, lon: 50.5106 },
  5: { name: "Jeddah", lat: 21.6319, lon: 39.1044 },
  6: { name: "Miami Gardens", lat: 25.9581, lon: -80.2389 },
  7: { name: "Imola", lat: 44.3439, lon: 11.7167 },
  8: { name: "Monaco", lat: 43.7347, lon: 7.4206 },
  9: { name: "Barcelona", lat: 41.57, lon: 2.2611 },
  10: { name: "Montréal", lat: 45.5, lon: -73.5228 },
  11: { name: "Spielberg", lat: 47.2197, lon: 14.7647 },
  12: { name: "Silverstone", lat: 52.0786, lon: -1.0169 },
  13: { name: "Spa-Francorchamps", lat: 50.4372, lon: 5.9714 },
  14: { name: "Budapest", lat: 47.5789, lon: 19.2486 },
  15: { name: "Zandvoort", lat: 52.3888, lon: 4.5409 },
  16: { name: "Monza", lat: 45.6156, lon: 9.2811 },
  17: { name: "Baku", lat: 40.3725, lon: 49.8533 },
  18: { name: "Marina Bay", lat: 1.2914, lon: 103.864 },
  19: { name: "Austin", lat: 30.1328, lon: -97.6411 },
  20: { name: "Mexico City", lat: 19.4042, lon: -99.0907 },
  21: { name: "São Paulo", lat: -23.7036, lon: -46.6997 },
  22: { name: "Las Vegas", lat: 36.1147, lon: -115.1728 },
  23: { name: "Lusail", lat: 25.49, lon: 51.4542 },
  24: { name: "Yas Island", lat: 24.4672, lon: 54.6031 },
  25: { name: "Miami", lat: 25.9581, lon: -80.2389 },
  26: { name: "Le Castellet", lat: 43.2506, lon: 5.7917 },
  27: { name: "Portimão", lat: 37.227, lon: -8.6267 },
  29: { name: "Sochi", lat: 43.4057, lon: 39.9578 },
  30: { name: "Istanbul", lat: 40.9517, lon: 29.405 },
};

export function circuitCoord(
  circuitId: number | null | undefined,
  circuitName?: string | null,
): { lat: number; lon: number } | null {
  if (typeof circuitId === "number") {
    const hit = CIRCUIT_COORDS[circuitId];
    if (hit) return { lat: hit.lat, lon: hit.lon };
  }
  if (circuitName) {
    const needle = circuitName.toLowerCase();
    for (const entry of Object.values(CIRCUIT_COORDS)) {
      const name = entry.name.toLowerCase();
      if (name.includes(needle) || needle.includes(name)) {
        return { lat: entry.lat, lon: entry.lon };
      }
    }
  }
  return null;
}
