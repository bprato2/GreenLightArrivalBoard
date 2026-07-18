import {
  GREEN_LINE_COLOR,
  ROUTE_ID,
  expandRouteFilter,
  isGreenLineRoute,
  type DirectionId,
} from "./boardConfig";
import {
  findStationOnLine,
  indexOnCorridor,
  type MiniMapCorridor,
} from "./corridor";
import {
  resolveStation,
  resolveStationByName,
  stationName,
  TARGET_STOP_ID,
  type StationInfo,
} from "./stations";
import { normalizeHeadsign } from "./headsign";
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

export interface BoardFilter {
  stopId: string;
  directionId: DirectionId;
  routeId: string;
}

export function getApiKey(): string {
  return process.env.NEXT_PUBLIC_MBTA_API_KEY?.trim() ?? "";
}

export function buildPredictionsUrl(
  apiKey: string,
  filter: BoardFilter = {
    stopId: TARGET_STOP_ID,
    directionId: 1,
    routeId: ROUTE_ID,
  },
): string {
  const params = new URLSearchParams({
    "filter[stop]": filter.stopId,
    "filter[route]": expandRouteFilter(filter.routeId),
    "filter[direction_id]": String(filter.directionId),
    include: "vehicle,trip,stop",
    api_key: apiKey,
  });
  return `${MBTA_BASE}/predictions?${params.toString()}`;
}

export function buildVehiclesUrl(
  apiKey: string,
  routeId: string = ROUTE_ID,
): string {
  const params = new URLSearchParams({
    "filter[route]": expandRouteFilter(routeId),
    include: "stop,trip,route",
    api_key: apiKey,
  });
  return `${MBTA_BASE}/vehicles?${params.toString()}`;
}

/** Build vehicles URL for one or many route ids. */
export function buildVehiclesUrlForRoutes(
  apiKey: string,
  routeIds: string[],
): string {
  const expanded = [
    ...new Set(
      routeIds.flatMap((id) => expandRouteFilter(id).split(",")).filter(Boolean),
    ),
  ];
  return buildVehiclesUrl(apiKey, expanded.join(",") || ROUTE_ID);
}

export function relatedId(
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

function vehicleMapPosition(
  vehicle: VehicleResource,
  stops: Map<string, StopResource>,
  corridor: StationInfo[],
  maxStationIndex: number,
  fullLine: StationInfo[],
): { stationIndex: number; progress: number } | null {
  const directionId = vehicle.attributes.direction_id ?? 0;
  const location = describeVehicleLocation(vehicle, stops, fullLine);

  let stationIndexValue = location.stationIndex;
  let progress = location.progress;

  if (stationIndexValue === null) {
    const fromCoords = positionFromLatLon(
      vehicle.attributes.latitude,
      vehicle.attributes.longitude,
      fullLine.length >= 2 ? fullLine : corridor,
    );
    if (!fromCoords) return null;
    stationIndexValue = fromCoords.stationIndex;
    progress = fromCoords.progress;
  }

  if (stationIndexValue > maxStationIndex) return null;
  if (corridor.length > 0 && stationIndexValue < corridor[0]!.index) return null;

  const status = vehicle.attributes.current_status;
  if (status === "IN_TRANSIT_TO" || status === "INCOMING_AT") {
    if (directionId === 1) {
      const prev = Math.max(0, stationIndexValue - 1);
      stationIndexValue = prev;
      progress = status === "INCOMING_AT" ? 0.92 : 0.55;
    } else {
      progress = status === "INCOMING_AT" ? 0.92 : 0.55;
    }
  } else if (status === "STOPPED_AT") {
    progress = 0;
  }

  return { stationIndex: stationIndexValue, progress };
}

/** Project GPS coordinates onto the mini-map polyline. */
function positionFromLatLon(
  lat: number | null,
  lon: number | null,
  corridor: StationInfo[],
): { stationIndex: number; progress: number } | null {
  if (lat === null || lon === null || corridor.length < 2) return null;

  let bestDist = Infinity;
  let bestIndex = corridor[0]!.index;
  let bestProgress = 0;

  for (let i = 0; i < corridor.length - 1; i++) {
    const a = corridor[i]!;
    const b = corridor[i + 1]!;
    const { t, dist } = projectPointOnSegment(lat, lon, a.lat, a.lon, b.lat, b.lon);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = a.index;
      bestProgress = t;
    }
  }

  // Reject positions far from the track (~2 km).
  if (bestDist > 0.02) return null;

  return { stationIndex: bestIndex, progress: bestProgress };
}

function projectPointOnSegment(
  lat: number,
  lon: number,
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): { t: number; dist: number } {
  const dx = lat2 - lat1;
  const dy = lon2 - lon1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const dist = Math.hypot(lat - lat1, lon - lon1);
    return { t: 0, dist };
  }
  const t = Math.max(0, Math.min(1, ((lat - lat1) * dx + (lon - lon1) * dy) / lenSq));
  const projLat = lat1 + t * dx;
  const projLon = lon1 + t * dy;
  const dist = Math.hypot(lat - projLat, lon - projLon);
  return { t, dist };
}

function describeVehicleLocation(
  vehicle: VehicleResource | undefined,
  stops: Map<string, StopResource>,
  line: StationInfo[] = [],
): { label: string | null; stationIndex: number | null; progress: number } {
  if (!vehicle) {
    return { label: null, stationIndex: null, progress: 0 };
  }

  const stopRelId = relatedId(vehicle, "stop");
  const parentId = parentStopId(stopRelId, stops);
  const idx =
    indexOnCorridor(line, parentId) ??
    indexOnCorridor(line, stopRelId);
  const name =
    (parentId ? findStationOnLine(line, parentId)?.name : null) ??
    stationName(parentId) ??
    (stopRelId ? stops.get(stopRelId)?.attributes.name : null) ??
    null;

  const status = vehicle.attributes.current_status;
  let label: string | null = null;
  let progress = 0;

  if (!name || idx === null) {
    return { label: name ? `Near ${name}` : null, stationIndex: idx, progress: 0 };
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

/** Derive sorted arrivals + map trains from the live collection. */
export function deriveBoardState(
  collection: StreamCollection,
  nowMs: number,
  filter: BoardFilter = {
    stopId: TARGET_STOP_ID,
    directionId: 1,
    routeId: ROUTE_ID,
  },
  routeColor: string = GREEN_LINE_COLOR,
  mapCorridor: MiniMapCorridor | null = null,
  fullLine: StationInfo[] = [],
  /** Route termini indexed by direction_id — used when trip headsign is missing. */
  directionDestinations: string[] | null = null,
): { arrivals: Arrival[]; trains: MapTrain[] } {
  const arrivals: Arrival[] = [];
  const onGreenLine = isGreenLineRoute(filter.routeId);
  const corridor = mapCorridor;
  const lineForLookup =
    fullLine.length > 0 ? fullLine : (corridor?.stations ?? []);
  const showMap = Boolean(corridor && corridor.stations.length > 0);
  const terminusFallback =
    directionDestinations?.[filter.directionId]?.trim() ||
    (onGreenLine
      ? filter.directionId === 1
        ? "Union Square"
        : "Riverside"
      : null);

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

    const location = showMap
      ? describeVehicleLocation(vehicle, collection.stops, lineForLookup)
      : { label: null as string | null, stationIndex: null as number | null, progress: 0 };
    const directionId =
      trip?.attributes.direction_id ?? attrs.direction_id ?? 0;
    if (directionId !== filter.directionId) continue;

    // Never use prediction status ("Approaching", etc.) as the destination label.
    const rawHeadsign = trip?.attributes.headsign?.trim() || "";
    const headsign = normalizeHeadsign(
      rawHeadsign,
      filter.directionId,
      terminusFallback,
    );

    arrivals.push({
      id: prediction.id,
      vehicleId,
      tripId,
      directionId,
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
      mbtaStatus: attrs.status,
      rowKind: "live",
      routeColor,
    });
  }

  arrivals.sort((a, b) => a.etaMs - b.etaMs);

  const trains: MapTrain[] = [];
  if (!showMap || !corridor) {
    return { arrivals, trains };
  }

  const seenVehicleIds = new Set<string>();

  const addTrain = (vehicle: VehicleResource) => {
    if (seenVehicleIds.has(vehicle.id)) return;
    const directionId = vehicle.attributes.direction_id ?? 0;
    if (directionId !== filter.directionId) return;

    const position = vehicleMapPosition(
      vehicle,
      collection.stops,
      corridor.stations,
      corridor.maxStationIndex,
      lineForLookup,
    );
    if (!position) return;

    seenVehicleIds.add(vehicle.id);
    trains.push({
      id: vehicle.id,
      label: vehicle.attributes.label,
      directionId,
      stationIndex: position.stationIndex,
      progress: position.progress,
      status: vehicle.attributes.current_status,
    });
  };

  for (const vehicle of collection.vehicles.values()) {
    addTrain(vehicle);
  }

  for (const prediction of collection.predictions.values()) {
    const vehicleId = relatedId(prediction, "vehicle");
    if (!vehicleId) continue;
    const vehicle = collection.vehicles.get(vehicleId);
    if (vehicle) addTrain(vehicle);
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
