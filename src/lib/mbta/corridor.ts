/**
 * Dynamic mini-map corridor: ordered stations for any MBTA route,
 * windowed around the selected departure stop.
 */

import {
  GREEN_LINE_ALL_ID,
  GREEN_LINE_BRANCH_IDS,
  expandRouteFilter,
} from "@/lib/mbta/boardConfig";
import {
  GREEN_D_STATIONS,
  resolveStation,
  type StationInfo,
} from "@/lib/mbta/stations";
import { haversineMeters } from "@/lib/walk";

const MBTA_BASE = "https://api-v3.mbta.com";

function getApiKey(): string {
  return process.env.NEXT_PUBLIC_MBTA_API_KEY?.trim() ?? "";
}

export interface MiniMapCorridor {
  stations: StationInfo[];
  hasContinuation: boolean;
  maxStationIndex: number;
  homeStopId: string;
  /** Full line length (for debugging / titles). */
  lineLength: number;
}

interface MbtaStopResource {
  id: string;
  attributes: {
    name: string;
    latitude: number | null;
    longitude: number | null;
    location_type: number;
  };
}

function apiKeyParam(apiKey: string): string {
  return apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
}

function shortStationName(name: string): string {
  const cleaned = name.replace(/\s+Station$/i, "").trim();
  if (cleaned.length <= 11) return cleaned;
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return `${cleaned.slice(0, 9)}…`;
  const two = `${parts[0]} ${parts[1]}`;
  return two.length <= 11 ? two : `${two.slice(0, 9)}…`;
}

/** Typical rail hop when GPS spacing is unknown. */
function estimateLegMinutes(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const meters = haversineMeters(a, b);
  // ~35 km/h average between stations → ~583 m/min; clamp to subway-like hops.
  const mins = Math.round(meters / 550);
  return Math.max(1, Math.min(8, mins || 2));
}

function toStationInfo(
  raw: MbtaStopResource[],
): StationInfo[] {
  const parents = raw.filter(
    (s) =>
      (s.attributes.location_type === 1 || s.id.startsWith("place-")) &&
      s.attributes.latitude != null &&
      s.attributes.longitude != null,
  );

  const ordered =
    parents.length > 0
      ? parents
      : raw.filter(
          (s) =>
            s.attributes.location_type === 0 &&
            s.attributes.latitude != null &&
            s.attributes.longitude != null,
        );

  const seen = new Set<string>();
  const unique: MbtaStopResource[] = [];
  for (const s of ordered) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    unique.push(s);
  }

  return unique.map((s, index) => {
    const lat = s.attributes.latitude!;
    const lon = s.attributes.longitude!;
    const next = unique[index + 1];
    const minutesToNext = next
      ? estimateLegMinutes(
          { lat, lon },
          { lat: next.attributes.latitude!, lon: next.attributes.longitude! },
        )
      : 0;
    return {
      id: s.id,
      name: s.attributes.name,
      shortName: shortStationName(s.attributes.name),
      index,
      lat,
      lon,
      minutesToNext,
    };
  });
}

/** Ordered parent stations along a route (API order preserved). */
export async function fetchOrderedStationsForRoute(
  routeId: string,
): Promise<StationInfo[]> {
  if (!routeId) return [];
  const apiKey = getApiKey();
  const routeFilter = expandRouteFilter(routeId);
  const url =
    `${MBTA_BASE}/stops?filter[route]=${encodeURIComponent(routeFilter)}` +
    `&fields[stop]=name,latitude,longitude,location_type` +
    apiKeyParam(apiKey);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Stops HTTP ${res.status}`);
  const body = (await res.json()) as { data: MbtaStopResource[] };
  return toStationInfo(body.data ?? []);
}

export function findStationOnLine(
  line: StationInfo[],
  stopId: string,
): StationInfo | null {
  if (!stopId) return null;
  const direct = line.find((s) => s.id === stopId);
  if (direct) return direct;

  const green = resolveStation(stopId);
  if (green) {
    const match = line.find((s) => s.id === green.id);
    if (match) return match;
  }

  for (const station of line) {
    const slug = station.id.replace("place-", "");
    if (stopId.includes(slug)) return station;
  }
  return null;
}

/**
 * Resolve the full ordered line for a board route selection.
 * Green-D (and Green-all when home is on D) use the curated static table.
 */
export async function fetchLineStations(
  routeId: string,
  stopId?: string,
): Promise<StationInfo[]> {
  if (routeId === "Green-D") return GREEN_D_STATIONS;

  if (routeId === GREEN_LINE_ALL_ID) {
    if (stopId && resolveStation(stopId)) return GREEN_D_STATIONS;
    for (const branch of GREEN_LINE_BRANCH_IDS) {
      const stations = await fetchOrderedStationsForRoute(branch);
      if (stopId && findStationOnLine(stations, stopId)) return stations;
    }
    return GREEN_D_STATIONS;
  }

  return fetchOrderedStationsForRoute(routeId);
}

/**
 * Window around home: 5 stations before + home + 1 after along travel direction.
 */
export function getCorridorWindow(
  line: StationInfo[],
  stopId: string,
  directionId: number = 1,
): MiniMapCorridor | null {
  if (line.length === 0) return null;

  const home = findStationOnLine(line, stopId) ?? line[0]!;
  const homeIdx = home.index;
  const before = 5;
  const after = 1;

  const start =
    directionId === 1
      ? Math.max(0, homeIdx - before)
      : Math.max(0, homeIdx - after);
  const end =
    directionId === 1
      ? Math.min(line.length - 1, homeIdx + after)
      : Math.min(line.length - 1, homeIdx + before);

  const stations = line.slice(start, end + 1);
  if (stations.length === 0) return null;

  return {
    stations,
    hasContinuation: end < line.length - 1,
    maxStationIndex: stations[stations.length - 1]!.index,
    homeStopId: home.id,
    lineLength: line.length,
  };
}

export function indexOnCorridor(
  corridor: StationInfo[],
  stopId: string | null | undefined,
): number | null {
  if (!stopId || corridor.length === 0) return null;
  return findStationOnLine(corridor, stopId)?.index ?? null;
}
