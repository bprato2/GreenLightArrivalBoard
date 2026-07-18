/**
 * Same-trip origin→destination schedule search via MBTA V3.
 */

import type { TransitMode } from "@/lib/providers/types";
import { routeTypesForMode } from "@/lib/providers/types";
import {
  estimateBusFare,
  estimateCommuterRailFare,
  estimateSubwayFare,
  type FareEstimate,
} from "@/lib/fares";

const MBTA_BASE = "https://api-v3.mbta.com";

export interface TripSearchParams {
  mode: TransitMode;
  originStopId: string;
  destinationStopId: string;
  date: string; // YYYY-MM-DD
  timePreference: "depart_after" | "arrive_by";
  time: string; // HH:mm
  routeId?: string;
  apiKey: string;
}

export interface TripItinerary {
  tripId: string;
  routeId: string;
  routeName: string;
  routeColor: string;
  headsign: string;
  departAt: string;
  arriveAt: string;
  durationMinutes: number;
  fare: FareEstimate;
}

interface ScheduleRow {
  id: string;
  tripId: string;
  routeId: string;
  stopSequence: number;
  timeMs: number;
  timeIso: string;
}

function apiKeyParam(apiKey: string): string {
  return apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
}

async function fetchSchedulesForStop(
  stopId: string,
  date: string,
  apiKey: string,
  routeId?: string,
): Promise<{
  rows: ScheduleRow[];
  trips: Map<string, { headsign: string }>;
  routes: Map<string, { name: string; color: string; type: number }>;
}> {
  const params = new URLSearchParams({
    "filter[stop]": stopId,
    "filter[date]": date,
    sort: "departure_time",
    include: "trip,route",
  });
  if (routeId) params.set("filter[route]", routeId);
  if (apiKey) params.set("api_key", apiKey);

  const res = await fetch(`${MBTA_BASE}/schedules?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Schedules HTTP ${res.status}`);

  const body = (await res.json()) as {
    data: Array<{
      id: string;
      attributes: {
        arrival_time: string | null;
        departure_time: string | null;
        stop_sequence: number | null;
      };
      relationships?: {
        trip?: { data?: { id: string } | null };
        route?: { data?: { id: string } | null };
      };
    }>;
    included?: Array<{
      id: string;
      type: string;
      attributes: Record<string, unknown>;
    }>;
  };

  const trips = new Map<string, { headsign: string }>();
  const routes = new Map<string, { name: string; color: string; type: number }>();
  for (const item of body.included ?? []) {
    if (item.type === "trip") {
      trips.set(item.id, {
        headsign: String(item.attributes.headsign ?? "Trip"),
      });
    }
    if (item.type === "route") {
      const color = item.attributes.color
        ? `#${String(item.attributes.color)}`
        : "#888888";
      routes.set(item.id, {
        name: String(
          item.attributes.long_name || item.attributes.short_name || item.id,
        ),
        color,
        type: Number(item.attributes.type ?? 0),
      });
    }
  }

  const rows: ScheduleRow[] = [];
  for (const s of body.data ?? []) {
    const timeIso = s.attributes.departure_time ?? s.attributes.arrival_time;
    if (!timeIso) continue;
    const timeMs = Date.parse(timeIso);
    if (Number.isNaN(timeMs)) continue;
    const tripId = s.relationships?.trip?.data?.id;
    const routeRel = s.relationships?.route?.data?.id;
    if (!tripId || !routeRel) continue;
    rows.push({
      id: s.id,
      tripId,
      routeId: routeRel,
      stopSequence: s.attributes.stop_sequence ?? 0,
      timeMs,
      timeIso,
    });
  }

  return { rows, trips, routes };
}

function parseLocalTimeOnDate(date: string, time: string): number {
  // Interpret as America/New_York wall time via ISO offset approximation (-04:00/-05:00).
  // Enough for filtering same-day schedules returned with offsets from MBTA.
  const [hh, mm] = time.split(":").map(Number);
  const probe = Date.parse(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00-04:00`);
  return Number.isNaN(probe) ? Date.parse(`${date}T12:00:00-04:00`) : probe;
}

function fareForMode(
  mode: TransitMode,
  routeId: string,
  routeName: string,
  originStopId: string,
  destinationStopId: string,
): FareEstimate {
  switch (mode) {
    case "subway":
      return estimateSubwayFare();
    case "bus":
      return estimateBusFare(routeId, routeName);
    case "commuter_rail":
      return estimateCommuterRailFare(originStopId, destinationStopId);
    default:
      return {
        amountUsd: null,
        currency: "USD",
        fareType: "Unavailable",
        zoneInfo: null,
        notes: "No MBTA fare for this mode.",
        officialUrl: "https://www.mbta.com/fares",
      };
  }
}

export async function searchDirectTrips(
  params: TripSearchParams,
): Promise<TripItinerary[]> {
  const {
    mode,
    originStopId,
    destinationStopId,
    date,
    timePreference,
    time,
    routeId,
    apiKey,
  } = params;

  if (mode === "amtrak") return [];
  if (originStopId === destinationStopId) return [];

  const types = routeTypesForMode(mode);
  if (!types) return [];

  const [origin, destination] = await Promise.all([
    fetchSchedulesForStop(originStopId, date, apiKey, routeId),
    fetchSchedulesForStop(destinationStopId, date, apiKey, routeId),
  ]);

  const destByTrip = new Map<string, ScheduleRow>();
  for (const row of destination.rows) {
    // Keep earliest matching dest row per trip.
    const prev = destByTrip.get(row.tripId);
    if (!prev || row.timeMs < prev.timeMs) destByTrip.set(row.tripId, row);
  }

  const allowedTypes = new Set(types);
  const preferenceMs = parseLocalTimeOnDate(date, time);
  const results: TripItinerary[] = [];

  for (const o of origin.rows) {
    const d = destByTrip.get(o.tripId);
    if (!d) continue;
    if (d.stopSequence <= o.stopSequence && d.timeMs <= o.timeMs) continue;

    const routeMeta =
      origin.routes.get(o.routeId) ??
      destination.routes.get(o.routeId) ??
      destination.routes.get(d.routeId);
    if (routeMeta && !allowedTypes.has(routeMeta.type)) continue;

    if (timePreference === "depart_after" && o.timeMs < preferenceMs) continue;
    if (timePreference === "arrive_by" && d.timeMs > preferenceMs) continue;

    const tripMeta = origin.trips.get(o.tripId) ?? destination.trips.get(o.tripId);
    const routeName = routeMeta?.name ?? o.routeId;
    const routeColor = routeMeta?.color ?? "#888888";
    const durationMinutes = Math.max(
      1,
      Math.round((d.timeMs - o.timeMs) / 60_000),
    );

    results.push({
      tripId: o.tripId,
      routeId: o.routeId,
      routeName,
      routeColor,
      headsign: tripMeta?.headsign ?? routeName,
      departAt: o.timeIso,
      arriveAt: d.timeIso,
      durationMinutes,
      fare: fareForMode(mode, o.routeId, routeName, originStopId, destinationStopId),
    });
  }

  results.sort((a, b) => Date.parse(a.departAt) - Date.parse(b.departAt));
  return results.slice(0, 40);
}
