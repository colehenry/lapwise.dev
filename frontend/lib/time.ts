export function formatRelativeTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = date.getTime() - Date.now();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 45) return "just now";

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const minutes = Math.round(diffSeconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");

  const hours = Math.round(diffSeconds / 3600);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");

  const days = Math.round(diffSeconds / 86400);
  if (Math.abs(days) < 30) return rtf.format(days, "day");

  const months = Math.round(diffSeconds / 2592000);
  if (Math.abs(months) < 12) return rtf.format(months, "month");

  const years = Math.round(diffSeconds / 31536000);
  return rtf.format(years, "year");
}
