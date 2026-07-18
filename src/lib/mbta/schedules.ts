import { GREEN_LINE_COLOR, ROUTE_ID, expandRouteFilter, isGreenLineRoute, type DirectionId } from "./boardConfig";
import { TARGET_STOP_ID } from "./stations";
import type { Arrival, ScheduleResource } from "./types";
import { normalizeHeadsign } from "./headsign";

const MBTA_BASE = "https://api-v3.mbta.com";

export function buildSchedulesUrl(
  apiKey: string,
  stopId: string = TARGET_STOP_ID,
  directionId: DirectionId = 1,
  routeId: string = ROUTE_ID,
): string {
  const params = new URLSearchParams({
    "filter[stop]": stopId,
    "filter[route]": expandRouteFilter(routeId),
    "filter[direction_id]": String(directionId),
    sort: "arrival_time",
    include: "trip",
    api_key: apiKey,
  });
  return `${MBTA_BASE}/schedules?${params.toString()}`;
}

interface ScheduleFetchResult {
  schedules: ScheduleResource[];
  trips: Map<string, { headsign: string }>;
}

export async function fetchSchedules(
  apiKey: string,
  stopId: string = TARGET_STOP_ID,
  directionId: DirectionId = 1,
  routeId: string = ROUTE_ID,
): Promise<ScheduleFetchResult> {
  const res = await fetch(buildSchedulesUrl(apiKey, stopId, directionId, routeId), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Schedules HTTP ${res.status}`);

  const body = (await res.json()) as {
    data: ScheduleResource[];
    included?: Array<{ id: string; type: string; attributes: { headsign?: string } }>;
  };

  const trips = new Map<string, { headsign: string }>();
  for (const item of body.included ?? []) {
    if (item.type === "trip" && item.attributes.headsign) {
      trips.set(item.id, { headsign: item.attributes.headsign });
    }
  }

  return { schedules: body.data ?? [], trips };
}

export async function fetchInboundSchedules(apiKey: string): Promise<ScheduleFetchResult> {
  return fetchSchedules(apiKey, TARGET_STOP_ID, 1, ROUTE_ID);
}

/** Next N scheduled departures/arrivals not already covered by live predictions. */
export function deriveScheduledArrivals(
  schedules: ScheduleResource[],
  trips: Map<string, { headsign: string }>,
  liveArrivals: Arrival[],
  nowMs: number,
  limit = 2,
  directionId: DirectionId = 1,
  routeColor: string = GREEN_LINE_COLOR,
  routeId: string = ROUTE_ID,
  directionDestinations: string[] | null = null,
): Arrival[] {
  const liveTripIds = new Set(
    liveArrivals.filter((a) => a.tripId).map((a) => a.tripId as string),
  );
  const liveEtaKeys = new Set(liveArrivals.map((a) => Math.round(a.etaMs / 60_000)));

  const rows: Arrival[] = [];
  const onGreenLine = isGreenLineRoute(routeId);
  const terminusFallback =
    directionDestinations?.[directionId]?.trim() ||
    (onGreenLine
      ? directionId === 1
        ? "Union Square"
        : "Riverside"
      : null);
  const defaultHeadsign = terminusFallback || "Scheduled";

  for (const schedule of schedules) {
    if (rows.length >= limit) break;

    const attrs = schedule.attributes;
    const timeStr = attrs.arrival_time ?? attrs.departure_time;
    if (!timeStr) continue;

    const etaMs = Date.parse(timeStr);
    if (Number.isNaN(etaMs) || etaMs < nowMs - 30_000) continue;

    const tripRel = schedule.relationships?.trip?.data;
    const tripId = tripRel && !Array.isArray(tripRel) ? tripRel.id : null;
    if (tripId && liveTripIds.has(tripId)) continue;

    const etaMinute = Math.round(etaMs / 60_000);
    if (liveEtaKeys.has(etaMinute)) continue;

    const trip = tripId ? trips.get(tripId) : undefined;
    const raw = trip?.headsign?.trim() ?? "";
    const headsign = normalizeHeadsign(raw || defaultHeadsign, directionId, terminusFallback);
    const minutesAway = Math.max(0, Math.ceil((etaMs - nowMs) / 60_000));

    rows.push({
      id: `sched-${schedule.id}`,
      vehicleId: null,
      tripId,
      directionId,
      headsign,
      etaMs,
      minutesAway,
      status: "on_time",
      scheduleRelationship: "scheduled",
      locationLabel: null,
      vehicleStationIndex: null,
      vehicleProgress: 0,
      isDelayed: false,
      isApproaching: false,
      mbtaStatus: null,
      rowKind: "scheduled",
      routeColor,
    });
  }

  return rows;
}
