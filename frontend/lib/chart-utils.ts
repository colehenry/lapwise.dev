export { COMPOUND_COLORS, getCompoundColor } from "@/lib/palette";

export const formatLapTime = (seconds: number | null | undefined) => {
  if (seconds == null) return "-";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, "0")}`;
};
