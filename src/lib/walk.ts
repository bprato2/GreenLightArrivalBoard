import { resolveStation } from "@/lib/mbta/stations";

/** Typical urban walking pace (~3 mph). */
const WALK_METERS_PER_MINUTE = 80;
/** Crow-flies → street-grid fudge for city blocks. */
const DETOUR_FACTOR = 1.3;

export interface StationCoords {
  lat: number;
  lon: number;
}

export interface WalkEstimate {
  meters: number;
  minutes: number;
  miles: number;
}

export function getStationCoords(stationId: string): StationCoords | null {
  const station = resolveStation(stationId);
  if (!station) return null;
  return { lat: station.lat, lon: station.lon };
}

/** Great-circle distance in meters. */
export function haversineMeters(a: StationCoords, b: StationCoords): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Approximate on-foot travel time from origin to a station. */
export function estimateWalk(from: StationCoords, to: StationCoords): WalkEstimate {
  const crowFlies = haversineMeters(from, to);
  const meters = crowFlies * DETOUR_FACTOR;
  const minutes =
    meters < 40 ? 0 : Math.max(1, Math.round(meters / WALK_METERS_PER_MINUTE));
  return {
    meters,
    minutes,
    miles: meters / 1609.344,
  };
}

export function formatWalkDistance(miles: number): string {
  if (miles < 0.05) return "< 0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/** Prompt a bit before walk time so you can grab keys / leave the building. */
export const LEAVE_EARLY_BUFFER_MINUTES = 2;

export type LeaveAdvice =
  | { kind: "idle" }
  /** Next train is already closer than walk time — skip it; wait for a later one. */
  | { kind: "missed"; trainMinutesAway: number; shortfallMinutes: number }
  /** Next catchable train is within the leave window. */
  | { kind: "leave"; trainMinutesAway: number };

/**
 * Advise whether to leave for a catchable train, or that the soonest one is already
 * unreachable given walking time. Leave-now only fires for a train you can still make.
 */
export function getLeaveAdvice(
  trainMinutesList: number[],
  walkMinutes: number | null,
  earlyBufferMinutes = LEAVE_EARLY_BUFFER_MINUTES,
): LeaveAdvice {
  if (walkMinutes === null || walkMinutes <= 0) return { kind: "idle" };
  if (trainMinutesList.length === 0) return { kind: "idle" };

  const catchableMinutes = trainMinutesList.find((mins) => mins >= walkMinutes);

  if (
    catchableMinutes !== undefined &&
    catchableMinutes <= walkMinutes + earlyBufferMinutes
  ) {
    return { kind: "leave", trainMinutesAway: catchableMinutes };
  }

  const closest = trainMinutesList[0]!;
  if (closest < walkMinutes) {
    return {
      kind: "missed",
      trainMinutesAway: closest,
      shortfallMinutes: walkMinutes - closest,
    };
  }

  return { kind: "idle" };
}
