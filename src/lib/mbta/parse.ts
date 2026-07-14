import {
  GREEN_D_STATIONS,
  resolveStation,
  resolveStationByName,
  stationIndex,
  stationName,
  TARGET_STOP_ID,
} from "./stations";
import type {
  Arrival,
  ArrivalStatus,
  MapTrain,
  MbtaRelationships,
  MbtaResource,
  PredictionResource,
  StopResource,
  StreamCollection,
  TripResource,
  VehicleResource,
} from "./types";

const MBTA_BASE = "https://api-v3.mbta.com";

export function getApiKey(): string {
  return process.env.NEXT_PUBLIC_MBTA_API_KEY?.trim() ?? "";
}

export function buildPredictionsUrl(apiKey: string): string {
  const params = new URLSearchParams({
    "filter[stop]": TARGET_STOP_ID,
    "filter[route]": "Green-D",
    "filter[direction_id]": "1",
    include: "vehicle,trip,stop",
    api_key: apiKey,
  });
  return `${MBTA_BASE}/predictions?${params.toString()}`;
}

export function buildVehiclesUrl(apiKey: string): string {
  const params = new URLSearchParams({
    "filter[route]": "Green-D",
    include: "stop,trip",
    api_key: apiKey,
  });
  return `${MBTA_BASE}/vehicles?${params.toString()}`;
}

function relatedId(
  resource: { relationships?: MbtaRelationships },
  key: string,
): string | null {
  const rel = resource.relationships?.[key]?.data;
  if (!rel || Array.isArray(rel)) return null;
  return rel.id;
}

function mergeIncluded(collection: StreamCollection, included: MbtaResource[]): void {
  for (const item of included) {
    switch (item.type) {
      case "vehicle":
        collection.vehicles.set(item.id, item as unknown as VehicleResource);
        break;
      case "stop":
        collection.stops.set(item.id, item as unknown as StopResource);
        break;
      case "trip":
        collection.trips.set(item.id, item as unknown as TripResource);
        break;
      case "prediction":
        collection.predictions.set(item.id, item as unknown as PredictionResource);
        break;
      default:
        break;
    }
  }
}

/** Apply a single SSE event payload to the in-memory collection. */
export function applyStreamEvent(
  collection: StreamCollection,
  eventType: string,
  raw: string,
  primaryType: "prediction" | "vehicle",
): void {
  if (!raw.trim()) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  const list: MbtaResource[] = Array.isArray(parsed)
    ? (parsed as MbtaResource[])
    : parsed && typeof parsed === "object" && "data" in (parsed as object)
      ? Array.isArray((parsed as { data: unknown }).data)
        ? ((parsed as { data: MbtaResource[] }).data)
        : [(parsed as { data: MbtaResource }).data].filter(Boolean)
      : [parsed as MbtaResource];

  const included =
    parsed &&
    typeof parsed === "object" &&
    "included" in (parsed as object) &&
    Array.isArray((parsed as { included: MbtaResource[] }).included)
      ? (parsed as { included: MbtaResource[] }).included
      : [];

  if (eventType === "reset") {
    if (primaryType === "prediction") {
      collection.predictions.clear();
    } else {
      collection.vehicles.clear();
    }
    for (const item of list) {
      if (item?.type === "prediction") {
        collection.predictions.set(item.id, item as unknown as PredictionResource);
      } else if (item?.type === "vehicle") {
        collection.vehicles.set(item.id, item as unknown as VehicleResource);
      }
    }
    mergeIncluded(collection, included);
    return;
  }

  if (eventType === "remove") {
    for (const item of list) {
      if (!item?.id) continue;
      if (primaryType === "prediction" || item.type === "prediction") {
        collection.predictions.delete(item.id);
      }
      if (primaryType === "vehicle" || item.type === "vehicle") {
        collection.vehicles.delete(item.id);
      }
    }
    return;
  }

  // add / update
  for (const item of list) {
    if (!item?.id || !item.type) continue;
    if (item.type === "prediction") {
      collection.predictions.set(item.id, item as unknown as PredictionResource);
    } else if (item.type === "vehicle") {
      collection.vehicles.set(item.id, item as unknown as VehicleResource);
    }
  }
  mergeIncluded(collection, included);
}

function parentStopId(stopId: string | null, stops: Map<string, StopResource>): string | null {
  if (!stopId) return null;
  if (stopId.startsWith("place-")) return stopId;

  const stop = stops.get(stopId);
  const parent = stop ? relatedId(stop, "parent_station") : null;
  if (parent?.startsWith("place-")) return parent;

  const fromId = resolveStation(stopId);
  if (fromId) return fromId.id;

  const fromName = resolveStationByName(stop?.attributes.name);
  if (fromName) return fromName.id;

  return parent ?? stopId;
}

function describeVehicleLocation(
  vehicle: VehicleResource | undefined,
  stops: Map<string, StopResource>,
): { label: string | null; stationIndex: number | null; progress: number } {
  if (!vehicle) {
    return { label: null, stationIndex: null, progress: 0 };
  }

  const stopRelId = relatedId(vehicle, "stop");
  const parentId = parentStopId(stopRelId, stops);
  const idx = stationIndex(parentId);
  const name =
    stationName(parentId) ??
    (stopRelId ? stops.get(stopRelId)?.attributes.name : null) ??
    null;

  const status = vehicle.attributes.current_status;
  let label: string | null = null;
  let progress = 0;

  if (!name || idx === null) {
    return { label: null, stationIndex: idx, progress: 0 };
  }

  switch (status) {
    case "STOPPED_AT":
      label = `Currently at ${name}`;
      progress = 0;
      break;
    case "INCOMING_AT":
      label = `Approaching ${name}`;
      progress = 0.85;
      break;
    case "IN_TRANSIT_TO":
      label = `En route to ${name}`;
      // Treat as moving toward this station from the previous one.
      progress = 0.45;
      break;
    default:
      label = `Near ${name}`;
      progress = 0.3;
  }

  return { label, stationIndex: idx, progress };
}

function classifyStatus(
  minutesAway: number,
  scheduleRelationship: string | null,
  statusField: string | null,
): { status: ArrivalStatus; isDelayed: boolean; isApproaching: boolean } {
  const rel = (scheduleRelationship ?? "").toLowerCase();
  const isDelayed = rel === "delayed" || /delay/i.test(statusField ?? "");
  const isApproaching = minutesAway <= 1 || /approaching|boarding|arriving/i.test(statusField ?? "");

  let status: ArrivalStatus = "on_time";
  if (isDelayed) status = "delayed";
  else if (isApproaching) status = minutesAway <= 0 ? "boarding" : "approaching";
  else if (!scheduleRelationship && !statusField) status = "unknown";

  return { status, isDelayed, isApproaching };
}

/** Derive sorted inbound arrivals + map trains from the live collection. */
export function deriveBoardState(
  collection: StreamCollection,
  nowMs: number,
): { arrivals: Arrival[]; trains: MapTrain[] } {
  const arrivals: Arrival[] = [];

  for (const prediction of collection.predictions.values()) {
    const attrs = prediction.attributes;
    const timeStr = attrs.arrival_time ?? attrs.departure_time;
    if (!timeStr) continue;

    const etaMs = Date.parse(timeStr);
    if (Number.isNaN(etaMs)) continue;

    // Drop departed / stale predictions (more than 45s past).
    if (etaMs < nowMs - 45_000) continue;

    const vehicleId = relatedId(prediction, "vehicle");
    const tripId = relatedId(prediction, "trip");
    const vehicle = vehicleId ? collection.vehicles.get(vehicleId) : undefined;
    const trip = tripId ? collection.trips.get(tripId) : undefined;

    const minutesAway = Math.max(0, Math.ceil((etaMs - nowMs) / 60_000));
    const { status, isDelayed, isApproaching } = classifyStatus(
      minutesAway,
      attrs.schedule_relationship,
      attrs.status,
    );

    const location = describeVehicleLocation(vehicle, collection.stops);
    const headsign =
      trip?.attributes.headsign ||
      attrs.status ||
      "Government Center";

    arrivals.push({
      id: prediction.id,
      vehicleId,
      tripId,
      headsign,
      etaMs,
      minutesAway,
      status,
      scheduleRelationship: attrs.schedule_relationship,
      locationLabel: location.label,
      vehicleStationIndex: location.stationIndex,
      vehicleProgress: location.progress,
      isDelayed,
      isApproaching,
    });
  }

  arrivals.sort((a, b) => a.etaMs - b.etaMs);

  const trains: MapTrain[] = [];
  for (const vehicle of collection.vehicles.values()) {
    const directionId = vehicle.attributes.direction_id ?? 0;
    const location = describeVehicleLocation(vehicle, collection.stops);
    if (location.stationIndex === null) continue;

    // For IN_TRANSIT_TO / INCOMING_AT, map position sits between previous and current.
    let stationIndexValue = location.stationIndex;
    let progress = location.progress;

    if (
      vehicle.attributes.current_status === "IN_TRANSIT_TO" ||
      vehicle.attributes.current_status === "INCOMING_AT"
    ) {
      const prev =
        directionId === 1
          ? Math.max(0, location.stationIndex - 1)
          : Math.min(GREEN_D_STATIONS.length - 1, location.stationIndex + 1);
      stationIndexValue = Math.min(prev, location.stationIndex);
      const span = Math.abs(location.stationIndex - prev) || 1;
      progress =
        vehicle.attributes.current_status === "INCOMING_AT"
          ? 0.9
          : 0.4;
      // Normalize so index is the western (lower) end of the segment for direction 1
      if (directionId === 1) {
        stationIndexValue = prev;
      } else {
        stationIndexValue = location.stationIndex;
        progress = 1 - progress;
      }
      void span;
    }

    trains.push({
      id: vehicle.id,
      label: vehicle.attributes.label,
      directionId,
      stationIndex: stationIndexValue,
      progress,
      status: vehicle.attributes.current_status,
    });
  }

  return { arrivals, trains };
}

export function emptyCollection(): StreamCollection {
  return {
    predictions: new Map(),
    vehicles: new Map(),
    stops: new Map(),
    trips: new Map(),
  };
}
