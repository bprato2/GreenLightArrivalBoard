import type { Arrival } from "./types";
import type { ScheduleResource } from "./types";

export interface ServiceFrequency {
  message: string;
  hasService: boolean;
}

/** Derive a human-readable headway message from schedules in the current hour. */
export function deriveServiceFrequencyFromSchedules(
  schedules: ScheduleResource[],
  nowMs: number,
): ServiceFrequency {
  const now = new Date(nowMs);
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);
  const hourEnd = new Date(hourStart);
  hourEnd.setHours(hourEnd.getHours() + 1);

  const times = schedules
    .map((s) => s.attributes.arrival_time ?? s.attributes.departure_time)
    .filter((t): t is string => Boolean(t))
    .map((t) => Date.parse(t))
    .filter((t) => !Number.isNaN(t) && t >= hourStart.getTime() && t < hourEnd.getTime())
    .sort((a, b) => a - b);

  if (times.length < 2) {
    return { message: "No scheduled service", hasService: false };
  }

  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push(Math.round((times[i]! - times[i - 1]!) / 60_000));
  }

  const min = Math.min(...gaps);
  const max = Math.max(...gaps);

  if (min === max) {
    return { message: `Trains every ${min} minutes`, hasService: true };
  }
  return { message: `Trains every ${min}–${max} minutes`, hasService: true };
}

/** Fallback headway from upcoming live arrivals when schedules are thin. */
export function deriveServiceFrequencyFromArrivals(
  arrivals: Arrival[],
  nowMs: number,
): ServiceFrequency {
  const upcoming = arrivals
    .filter((a) => (a.rowKind ?? "live") === "live" && a.etaMs >= nowMs - 30_000)
    .sort((a, b) => a.etaMs - b.etaMs);

  if (upcoming.length === 0) {
    return { message: "No matching trains", hasService: false };
  }

  if (upcoming.length < 2) {
    const mins = upcoming[0]!.minutesAway;
    return {
      message: mins <= 0 ? "Train arriving now" : `Next train in ${mins} min`,
      hasService: true,
    };
  }

  const gaps: number[] = [];
  for (let i = 1; i < Math.min(upcoming.length, 5); i++) {
    gaps.push(
      Math.max(1, Math.round((upcoming[i]!.etaMs - upcoming[i - 1]!.etaMs) / 60_000)),
    );
  }

  const min = Math.min(...gaps);
  const max = Math.max(...gaps);

  if (min === max) {
    return { message: `Trains every ${min} minutes`, hasService: true };
  }
  return { message: `Trains every ${min}–${max} minutes`, hasService: true };
}

/**
 * Prefer schedule-based headway; fall back to live ETA gaps when schedules
 * do not yield a usable current-hour message.
 */
export function deriveServiceFrequency(
  schedules: ScheduleResource[],
  arrivals: Arrival[],
  nowMs: number,
): ServiceFrequency {
  const fromSchedules = deriveServiceFrequencyFromSchedules(schedules, nowMs);
  if (fromSchedules.hasService) return fromSchedules;
  return deriveServiceFrequencyFromArrivals(arrivals, nowMs);
}
