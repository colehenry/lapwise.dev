export { COMPOUND_COLORS, getCompoundColor } from "@/lib/palette";

export const formatLapTime = (seconds: number | null | undefined) => {
  if (seconds == null) return "-";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, "0")}`;
};

export const maxLapNumber = (
  drivers: { laps: { lap_number: number }[] }[],
): number =>
  Math.max(
    0,
    ...drivers.flatMap((driver) => driver.laps.map((lap) => lap.lap_number)),
  );
