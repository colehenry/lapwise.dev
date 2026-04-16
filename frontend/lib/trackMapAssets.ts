const AVAILABLE_STATIC_TRACK_MAP_IDS = new Set(
  Array.from({ length: 35 }, (_, index) => index + 1),
);

export function hasStaticTrackMap(circuitId: number | null | undefined) {
  return (
    typeof circuitId === "number" &&
    AVAILABLE_STATIC_TRACK_MAP_IDS.has(circuitId)
  );
}

export function getStaticTrackMapUrl(circuitId: number) {
  return `/track-maps/${circuitId}.png`;
}
