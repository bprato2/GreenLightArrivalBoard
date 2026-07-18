/** Formatting helpers for the LED board. */

import type { Arrival } from "@/lib/mbta/types";

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

/** Normalize MBTA prediction status to sign-style labels. */
export function formatMbtaStatusLabel(status: string | null | undefined): string | null {
  if (!status?.trim()) return null;
  const s = status.toLowerCase();
  if (/board|all aboard/.test(s)) return "Boarding";
  if (/arriv/.test(s)) return "Arriving";
  if (/approach/.test(s)) return "Approaching";
  if (/depart/.test(s)) return "Departing";
  return null;
}

/** ETA column text — status labels take priority over numeric countdown for live rows. */
export function formatArrivalDisplay(arrival: Arrival): string {
  if (arrival.rowKind === "live") {
    const fromApi = formatMbtaStatusLabel(arrival.mbtaStatus);
    if (fromApi) return fromApi;
    if (arrival.minutesAway <= 0) return "Arriving";
    if (arrival.isApproaching && arrival.minutesAway <= 1) return "Approaching";
  }
  return formatMinutes(arrival.minutesAway);
}

export function isStatusDisplay(text: string): boolean {
  return /^(Arriving|Approaching|Boarding|Departing)$/.test(text);
}
