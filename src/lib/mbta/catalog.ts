/**
 * Fetch MBTA V3 routes and stops for the live board / planner catalogs.
 */

import {
  GREEN_LINE_ALL_ID,
  GREEN_LINE_COLOR,
  expandRouteFilter,
} from "@/lib/mbta/boardConfig";
import { getApiKey } from "@/lib/mbta/parse";
import type { TransitMode, TransitRoute, TransitStop } from "@/lib/providers/types";
import { routeTypesForMode, TRANSIT_MODES } from "@/lib/providers/types";

const MBTA_BASE = "https://api-v3.mbta.com";

/** A stop reachable on a specific mode + route (for the all-stations picker). */
export interface NetworkStopEntry {
  key: string;
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  mode: TransitMode;
  modeLabel: string;
  routeId: string;
  routeLabel: string;
  routeShortName?: string;
  routeColor: string;
}

function modeLabel(mode: TransitMode): string {
  return TRANSIT_MODES.find((m) => m.id === mode)?.label ?? mode;
}

function routeDisplayName(route: TransitRoute): string {
  if (route.id === GREEN_LINE_ALL_ID) return "Green Line";
  if (route.shortName) return route.shortName;
  return route.label;
}

let networkCatalogPromise: Promise<NetworkStopEntry[]> | null = null;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Load stops across subway, commuter rail, and bus with mode/route metadata.
 * Cached for the session. Bus routes are capped to keep the first load usable.
 */
export function fetchNetworkStopCatalog(): Promise<NetworkStopEntry[]> {
  if (!networkCatalogPromise) {
    networkCatalogPromise = buildNetworkStopCatalog().catch((err) => {
      networkCatalogPromise = null;
      throw err;
    });
  }
  return networkCatalogPromise;
}

async function buildNetworkStopCatalog(): Promise<NetworkStopEntry[]> {
  const modes: TransitMode[] = ["subway", "commuter_rail", "bus"];
  const entries: NetworkStopEntry[] = [];
  const seen = new Set<string>();

  for (const mode of modes) {
    const routes = await fetchRoutesForMode(mode);
    // Skip synthetic Green-all (branches already listed); cap bus volume.
    const usable = routes.filter((r) => r.id !== GREEN_LINE_ALL_ID);
    const limited =
      mode === "bus" ? usable.slice(0, 60) : usable;

    const perRoute = await mapPool(limited, 5, async (route) => {
      try {
        const stops = await fetchStopsForRoute(route.id);
        return { route, stops };
      } catch {
        return { route, stops: [] as TransitStop[] };
      }
    });

    for (const { route, stops } of perRoute) {
      const line = routeDisplayName(route);
      for (const stop of stops) {
        const key = `${mode}::${route.id}::${stop.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({
          key,
          stopId: stop.id,
          stopName: stop.name,
          lat: stop.lat,
          lon: stop.lon,
          mode,
          modeLabel: modeLabel(mode),
          routeId: route.id,
          routeLabel: line,
          routeShortName: route.shortName,
          routeColor: route.color,
        });
      }
    }
  }

  entries.sort((a, b) => {
    const modeOrder =
      modes.indexOf(a.mode) - modes.indexOf(b.mode) ||
      a.routeLabel.localeCompare(b.routeLabel) ||
      a.stopName.localeCompare(b.stopName);
    return modeOrder;
  });

  return entries;
}

interface MbtaRouteResource {
  id: string;
  attributes: {
    short_name: string | null;
    long_name: string;
    color: string | null;
    type: number;
    direction_names?: string[] | null;
    direction_destinations?: string[] | null;
  };
}

interface MbtaStopResource {
  id: string;
  attributes: {
    name: string;
    latitude: number | null;
    longitude: number | null;
    location_type: number;
  };
  relationships?: {
    parent_station?: { data?: { id: string } | null };
  };
}

function apiKeyParam(apiKey: string): string {
  return apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
}

function toTransitStop(s: MbtaStopResource): TransitStop {
  return {
    id: s.id,
    name: s.attributes.name,
    lat: s.attributes.latitude ?? 0,
    lon: s.attributes.longitude ?? 0,
  };
}

/**
 * Prefer parent stations (location_type 1 / place-*). If the route only has
 * boarding stops (type 0), collapse by name so the picker stays usable.
 *
 * Note: MBTA V3 does **not** support filter[location_types] — filter client-side.
 */
function normalizeStopsForPicker(raw: MbtaStopResource[]): TransitStop[] {
  const parents = raw.filter(
    (s) => s.attributes.location_type === 1 || s.id.startsWith("place-"),
  );
  if (parents.length > 0) {
    const seen = new Set<string>();
    return parents
      .map(toTransitStop)
      .filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Bus / surface stops: one entry per display name (first id wins).
  const byName = new Map<string, TransitStop>();
  for (const s of raw) {
    if (s.attributes.location_type !== 0) continue;
    const key = s.attributes.name.toLowerCase();
    if (byName.has(key)) continue;
    byName.set(key, toTransitStop(s));
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchRoutesForMode(mode: TransitMode): Promise<TransitRoute[]> {
  const types = routeTypesForMode(mode);
  if (!types) return [];

  const apiKey = getApiKey();
  const typeFilter = types.join(",");
  const url =
    `${MBTA_BASE}/routes?filter[type]=${typeFilter}` +
    `&fields[route]=short_name,long_name,color,type,direction_names,direction_destinations` +
    apiKeyParam(apiKey);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Routes HTTP ${res.status}`);

  const body = (await res.json()) as { data: MbtaRouteResource[] };
  const routes: TransitRoute[] = (body.data ?? []).map((r) => ({
    id: r.id,
    label: r.attributes.long_name || r.attributes.short_name || r.id,
    shortName: r.attributes.short_name ?? undefined,
    color: r.attributes.color ? `#${r.attributes.color}` : "#888888",
    type: r.attributes.type,
  }));

  // Offer "Green Line" (all branches) above the individual B/C/D/E options.
  if (mode === "subway") {
    const greenIdx = routes.findIndex((r) => r.id.startsWith("Green-"));
    if (greenIdx >= 0) {
      routes.splice(greenIdx, 0, {
        id: GREEN_LINE_ALL_ID,
        label: "Green Line",
        shortName: "Green",
        color: GREEN_LINE_COLOR,
        type: 0,
      });
    }
  }

  return routes;
}

export async function fetchStopsForRoute(routeId: string): Promise<TransitStop[]> {
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
  return normalizeStopsForPicker(body.data ?? []);
}

/** Search parent stops by name (for trip planner origin/destination). */
export async function searchStops(
  query: string,
  mode: TransitMode,
): Promise<TransitStop[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const types = routeTypesForMode(mode);
  if (!types) return [];

  const routes = await fetchRoutesForMode(mode);
  const routeIds = [
    ...new Set(
      routes
        .slice(0, mode === "bus" ? 40 : routes.length)
        .flatMap((r) => expandRouteFilter(r.id).split(",")),
    ),
  ];
  if (routeIds.length === 0) return [];

  const apiKey = getApiKey();
  const url =
    `${MBTA_BASE}/stops?filter[route]=${encodeURIComponent(routeIds.join(","))}` +
    `&fields[stop]=name,latitude,longitude,location_type` +
    apiKeyParam(apiKey);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Stop search HTTP ${res.status}`);
  const body = (await res.json()) as { data: MbtaStopResource[] };
  const normalized = normalizeStopsForPicker(body.data ?? []);
  const lower = q.toLowerCase();
  return normalized.filter((s) => s.name.toLowerCase().includes(lower)).slice(0, 40);
}
