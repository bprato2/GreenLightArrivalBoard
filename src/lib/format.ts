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
    second: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  }).format(date);

  return { dateLine, timeLine };
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "ARR";
  if (minutes === 1) return "1 min";
  return `${minutes} min`;
}
