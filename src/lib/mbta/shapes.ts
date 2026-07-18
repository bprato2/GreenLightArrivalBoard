/**
 * Route polylines and overview geometry for the live map view.
 */

import {
  GREEN_LINE_ALL_ID,
  GREEN_LINE_BRANCH_IDS,
  GREEN_LINE_COLOR,
  expandRouteFilter,
} from "@/lib/mbta/boardConfig";
import { fetchLineStations } from "@/lib/mbta/corridor";
import { getApiKey } from "@/lib/mbta/parse";
import type { StationInfo } from "@/lib/mbta/stations";

const MBTA_BASE = "https://api-v3.mbta.com";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface RoutePolyline {
  routeId: string;
  color: string;
  /** Decoded shape points (may be multiple shape segments concatenated). */
  points: LatLon[];
  stations: StationInfo[];
}

/** Rapid-transit routes drawn on the subway overview map. */
export const SUBWAY_OVERVIEW_ROUTES: { id: string; color: string }[] = [
  { id: "Red", color: "#da291c" },
  { id: "Orange", color: "#ed8b00" },
  { id: "Blue", color: "#003da5" },
  { id: "Mattapan", color: "#da291c" },
  { id: "Green-B", color: GREEN_LINE_COLOR },
  { id: "Green-C", color: GREEN_LINE_COLOR },
  { id: "Green-D", color: GREEN_LINE_COLOR },
  { id: "Green-E", color: GREEN_LINE_COLOR },
];

function apiKeyParam(apiKey: string): string {
  return apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
}

/**
 * Decode a Google-encoded polyline into lat/lon points.
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): LatLon[] {
  const points: LatLon[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlon = result & 1 ? ~(result >> 1) : result >> 1;
    lon += dlon;

    points.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }

  return points;
}

interface MbtaShapeResource {
  id: string;
  attributes: { polyline?: string | null };
}

const polylineCache = new Map<string, Promise<LatLon[]>>();

async function fetchShapePoints(routeId: string): Promise<LatLon[]> {
  const filter = expandRouteFilter(routeId);
  const cached = polylineCache.get(filter);
  if (cached) return cached;

  const promise = (async () => {
    const apiKey = getApiKey();
    const url =
      `${MBTA_BASE}/shapes?filter[route]=${encodeURIComponent(filter)}` +
      `&fields[shape]=polyline` +
      apiKeyParam(apiKey);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Shapes HTTP ${res.status}`);

    const body = (await res.json()) as { data: MbtaShapeResource[] };
    const all: LatLon[] = [];
    for (const shape of body.data ?? []) {
      const poly = shape.attributes.polyline;
      if (!poly) continue;
      const decoded = decodePolyline(poly);
      if (decoded.length === 0) continue;
      // Separate shape segments with a break (NaN sentinel skipped in SVG).
      if (all.length > 0) all.push({ lat: Number.NaN, lon: Number.NaN });
      all.push(...decoded);
    }
    return all;
  })().catch((err) => {
    polylineCache.delete(filter);
    throw err;
  });

  polylineCache.set(filter, promise);
  return promise;
}

/** Build a polyline from ordered station coordinates (fallback). */
function stationsToPolyline(stations: StationInfo[]): LatLon[] {
  return stations
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map((s) => ({ lat: s.lat, lon: s.lon }));
}

/**
 * Load geometry + stations for one route (shapes preferred, stations fallback).
 */
export async function fetchRoutePolyline(
  routeId: string,
  color: string,
  stopId?: string,
): Promise<RoutePolyline> {
  if (!routeId) {
    return { routeId, color, points: [], stations: [] };
  }

  const stations = await fetchLineStations(routeId, stopId).catch(() => [] as StationInfo[]);
  let points: LatLon[] = [];
  try {
    points = await fetchShapePoints(routeId);
  } catch {
    points = [];
  }
  if (points.length < 2) {
    points = stationsToPolyline(stations);
  }

  return { routeId, color, points, stations };
}

let subwayOverviewPromise: Promise<RoutePolyline[]> | null = null;
const modeOverviewCache = new Map<string, Promise<RoutePolyline[]>>();

/** Session-cached polylines for all subway / rapid-transit lines. */
export function fetchSubwayOverviewPolylines(): Promise<RoutePolyline[]> {
  if (!subwayOverviewPromise) {
    subwayOverviewPromise = Promise.all(
      SUBWAY_OVERVIEW_ROUTES.map((r) => fetchRoutePolyline(r.id, r.color)),
    ).catch((err) => {
      subwayOverviewPromise = null;
      throw err;
    });
  }
  return subwayOverviewPromise;
}

/** Fetch polylines for an explicit list of routes (parallel, cached per route). */
export async function fetchPolylinesForRoutes(
  routes: { id: string; color: string }[],
): Promise<RoutePolyline[]> {
  const usable = routes.filter((r) => r.id && r.id !== GREEN_LINE_ALL_ID);
  const results: RoutePolyline[] = [];
  const chunk = 8;
  for (let i = 0; i < usable.length; i += chunk) {
    const batch = usable.slice(i, i + chunk);
    const part = await Promise.all(
      batch.map((r) => fetchRoutePolyline(r.id, r.color)),
    );
    results.push(...part);
  }
  return results;
}

/**
 * All routes for a transit mode (subway uses curated rapid-transit set).
 * Session-cached per mode.
 */
export async function fetchModeOverviewPolylines(
  mode: "subway" | "commuter_rail" | "bus" | "ferry",
): Promise<RoutePolyline[]> {
  if (mode === "subway") return fetchSubwayOverviewPolylines();

  const cached = modeOverviewCache.get(mode);
  if (cached) return cached;

  const promise = (async () => {
    const { fetchRoutesForMode } = await import("@/lib/mbta/catalog");
    const routes = await fetchRoutesForMode(mode);
    // Bus network is huge — still load all shapes, but skip synthetic Green-all.
    return fetchPolylinesForRoutes(
      routes
        .filter((r) => r.id !== GREEN_LINE_ALL_ID)
        .map((r) => ({ id: r.id, color: r.color || "#888888" })),
    );
  })().catch((err) => {
    modeOverviewCache.delete(mode);
    throw err;
  });

  modeOverviewCache.set(mode, promise);
  return promise;
}

/** Resolve which overview route ids to highlight for a board selection. */
export function highlightRouteIds(selectedRouteId: string): Set<string> {
  if (selectedRouteId === GREEN_LINE_ALL_ID) {
    return new Set(GREEN_LINE_BRANCH_IDS);
  }
  return new Set([selectedRouteId]);
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export function boundsFromPoints(points: LatLon[]): MapBounds | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let any = false;
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    any = true;
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  if (!any) return null;
  return { minLat, maxLat, minLon, maxLon };
}

export function mergeBounds(a: MapBounds | null, b: MapBounds | null): MapBounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minLat: Math.min(a.minLat, b.minLat),
    maxLat: Math.max(a.maxLat, b.maxLat),
    minLon: Math.min(a.minLon, b.minLon),
    maxLon: Math.max(a.maxLon, b.maxLon),
  };
}

/** Project geographic bounds into an SVG viewBox with padding. */
export function projectToViewBox(
  bounds: MapBounds,
  width = 1000,
  height = 1000,
  pad = 0.08,
): {
  viewBox: string;
  project: (lat: number, lon: number) => { x: number; y: number } | null;
} {
  const latPad = (bounds.maxLat - bounds.minLat) * pad || 0.01;
  const lonPad = (bounds.maxLon - bounds.minLon) * pad || 0.01;
  const minLat = bounds.minLat - latPad;
  const maxLat = bounds.maxLat + latPad;
  const minLon = bounds.minLon - lonPad;
  const maxLon = bounds.maxLon + lonPad;
  const spanLat = maxLat - minLat || 0.01;
  const spanLon = maxLon - minLon || 0.01;

  // Keep aspect roughly geographic (lon compressed by cos(mid lat)).
  const midLat = (minLat + maxLat) / 2;
  const lonScale = Math.cos((midLat * Math.PI) / 180);
  const geoW = spanLon * lonScale;
  const geoH = spanLat;
  const aspect = geoW / geoH;
  let vbW = width;
  let vbH = height;
  if (aspect > width / height) {
    vbH = width / aspect;
  } else {
    vbW = height * aspect;
  }

  const project = (lat: number, lon: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const x = ((lon - minLon) / spanLon) * vbW;
    const y = ((maxLat - lat) / spanLat) * vbH;
    return { x, y };
  };

  return { viewBox: `0 0 ${vbW} ${vbH}`, project };
}

/** Build SVG path `d` from projected points; NaN breaks start a new subpath. */
export function pointsToPathD(
  points: LatLon[],
  project: (lat: number, lon: number) => { x: number; y: number } | null,
): string {
  const parts: string[] = [];
  let started = false;
  for (const p of points) {
    const xy = project(p.lat, p.lon);
    if (!xy) {
      started = false;
      continue;
    }
    parts.push(`${started ? "L" : "M"}${xy.x.toFixed(2)} ${xy.y.toFixed(2)}`);
    started = true;
  }
  return parts.join(" ");
}
