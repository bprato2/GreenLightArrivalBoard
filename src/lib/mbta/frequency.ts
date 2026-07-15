import type { ScheduleResource } from "./types";

export interface ServiceFrequency {
  message: string;
  hasService: boolean;
}

/** Derive a human-readable headway message from schedules in the current hour. */
export function deriveServiceFrequency(
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
