const EM_DASH = "—";

/** A lap or sector time, to the thousandth. */
export function seconds3(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EM_DASH;
  return value.toFixed(3);
}

/** A signed interval, as the console reads gaps. */
export function gapLabel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EM_DASH;
  return `+${value.toFixed(3)}`;
}

/** Elapsed session time: `1:52:15`, or `52:15` inside the hour. */
export function sessionClock(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}`
    : `${minutes}:${secs}`;
}

/** A whole number, or a dash where the database has none. */
export function integer(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EM_DASH;
  return String(Math.round(value));
}

export function lapTag(lap: number | null | undefined): string {
  if (lap == null || !Number.isFinite(lap)) return EM_DASH;
  return `L${String(lap).padStart(2, "0")}`;
}

/** A UTC date, formatted without dragging the reader's timezone into it. */
export function utcDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { ...options, timeZone: "UTC" });
}

/** Team colours arrive without the hash. */
export function teamTint(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  return color.startsWith("#") ? color : `#${color}`;
}
