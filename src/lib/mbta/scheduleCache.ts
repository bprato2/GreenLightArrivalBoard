import { fetchSchedules } from "./schedules";
import type { DirectionId } from "./boardConfig";
import type { ScheduleResource } from "./types";

const REFRESH_MS = 5 * 60 * 1000;

interface CachedScheduleData {
  schedules: ScheduleResource[];
  trips: Map<string, { headsign: string }>;
  fetchedAt: number;
  cacheKey: string;
}

let cache: CachedScheduleData | null = null;
let inflight: Promise<CachedScheduleData> | null = null;
let inflightKey: string | null = null;

function keyFor(stopId: string, directionId: DirectionId, routeId: string): string {
  return `${routeId}:${stopId}:${directionId}`;
}

/** Shared schedule cache — reused by scheduled rows and frequency display. */
export async function getSchedules(
  apiKey: string,
  stopId: string,
  directionId: DirectionId,
  routeId: string,
): Promise<CachedScheduleData> {
  const cacheKey = keyFor(stopId, directionId, routeId);
  const now = Date.now();
  if (cache && cache.cacheKey === cacheKey && now - cache.fetchedAt < REFRESH_MS) {
    return cache;
  }

  if (inflight && inflightKey === cacheKey) return inflight;

  inflightKey = cacheKey;
  inflight = fetchSchedules(apiKey, stopId, directionId, routeId)
    .then((result) => {
      cache = {
        schedules: result.schedules,
        trips: result.trips,
        fetchedAt: Date.now(),
        cacheKey,
      };
      return cache;
    })
    .finally(() => {
      inflight = null;
      inflightKey = null;
    });

  return inflight;
}

export async function getInboundSchedules(apiKey: string): Promise<CachedScheduleData> {
  return getSchedules(apiKey, "place-newtn", 1, "Green-D");
}

export function peekSchedules(): CachedScheduleData | null {
  return cache;
}
