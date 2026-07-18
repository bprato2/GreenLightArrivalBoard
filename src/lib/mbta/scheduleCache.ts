import { fetchInboundSchedules } from "./schedules";
import type { ScheduleResource } from "./types";

const REFRESH_MS = 5 * 60 * 1000;

interface CachedScheduleData {
  schedules: ScheduleResource[];
  trips: Map<string, { headsign: string }>;
  fetchedAt: number;
}

let cache: CachedScheduleData | null = null;
let inflight: Promise<CachedScheduleData> | null = null;

/** Shared schedule cache — reused by scheduled rows and frequency display. */
export async function getInboundSchedules(apiKey: string): Promise<CachedScheduleData> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < REFRESH_MS) {
    return cache;
  }

  if (inflight) return inflight;

  inflight = fetchInboundSchedules(apiKey)
    .then((result) => {
      cache = {
        schedules: result.schedules,
        trips: result.trips,
        fetchedAt: Date.now(),
      };
      return cache;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function peekInboundSchedules(): CachedScheduleData | null {
  return cache;
}
