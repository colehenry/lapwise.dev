export const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#e8002d",
  MEDIUM: "#ffd700",
  HARD: "#c8c8c8",
  INTERMEDIATE: "#39b54a",
  WET: "#0067ff",
};

export const getCompoundColor = (compound: string | null | undefined) =>
  COMPOUND_COLORS[compound ?? ""] ?? "#888888";

export const formatLapTime = (seconds: number | null | undefined) => {
  if (seconds == null) return "-";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, "0")}`;
};
