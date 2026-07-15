/** Formatting helpers for the LED board. */

export function formatClock(date: Date): { dateLine: string; timeLine: string } {
  const dateLine = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);

  const timeLine = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  })
    .format(date)
    .replace(/\s*(AM|PM)/i, "");

  return { dateLine, timeLine };
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "ARR";
  if (minutes === 1) return "1 min";
  return `${minutes} min`;
}

/** Format a scheduled time for display (e.g. "9:42"). */
export function formatScheduledTime(etaMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  })
    .format(new Date(etaMs))
    .replace(/\s*(AM|PM)/i, "");
}
