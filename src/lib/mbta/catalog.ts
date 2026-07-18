/**
 * Fetch MBTA V3 routes and stops for the live board / planner catalogs.
 */

import { getApiKey } from "@/lib/mbta/parse";
import type { TransitMode, TransitRoute, TransitStop } from "@/lib/providers/types";
import { routeTypesForMode } from "@/lib/providers/types";

const MBTA_BASE = "https://api-v3.mbta.com";

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
}

function apiKeyParam(apiKey: string): string {
  return apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : "";
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
  return (body.data ?? []).map((r) => ({
    id: r.id,
    label: r.attributes.long_name || r.attributes.short_name || r.id,
    shortName: r.attributes.short_name ?? undefined,
    color: r.attributes.color ? `#${r.attributes.color}` : "#888888",
    type: r.attributes.type,
  }));
}

export async function fetchStopsForRoute(routeId: string): Promise<TransitStop[]> {
  if (!routeId) return [];
  const apiKey = getApiKey();
  const url =
    `${MBTA_BASE}/stops?filter[route]=${encodeURIComponent(routeId)}` +
    `&filter[location_types]=1` +
    `&fields[stop]=name,latitude,longitude,location_type` +
    apiKeyParam(apiKey);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Stops HTTP ${res.status}`);

  const body = (await res.json()) as { data: MbtaStopResource[] };
  let stops = (body.data ?? [])
    .filter((s) => s.attributes.location_type === 1 || s.id.startsWith("place-"))
    .map((s) => ({
      id: s.id,
      name: s.attributes.name,
      lat: s.attributes.latitude ?? 0,
      lon: s.attributes.longitude ?? 0,
    }));

  // Some bus routes only expose child stops (location_type 0).
  if (stops.length === 0) {
    const url2 =
      `${MBTA_BASE}/stops?filter[route]=${encodeURIComponent(routeId)}` +
      `&fields[stop]=name,latitude,longitude,location_type` +
      apiKeyParam(apiKey);
    const res2 = await fetch(url2, { cache: "no-store" });
    if (!res2.ok) throw new Error(`Stops HTTP ${res2.status}`);
    const body2 = (await res2.json()) as { data: MbtaStopResource[] };
    stops = (body2.data ?? []).map((s) => ({
      id: s.id,
      name: s.attributes.name,
      lat: s.attributes.latitude ?? 0,
      lon: s.attributes.longitude ?? 0,
    }));
  }

  // Prefer parent stations; dedupe by id.
  const seen = new Set<string>();
  return stops.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
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

  const apiKey = getApiKey();
  // Fetch routes for mode then stops is heavy; use stop search with route_type via routes include.
  // V3 supports filter[route_type] on stops in some versions — fall back to route-filtered batch.
  const routes = await fetchRoutesForMode(mode);
  const routeIds = routes.slice(0, mode === "bus" ? 40 : routes.length).map((r) => r.id);
  if (routeIds.length === 0) return [];

  const url =
    `${MBTA_BASE}/stops?filter[route]=${encodeURIComponent(routeIds.join(","))}` +
    `&filter[location_types]=1` +
    `&fields[stop]=name,latitude,longitude,location_type` +
    apiKeyParam(apiKey);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Stop search HTTP ${res.status}`);
  const body = (await res.json()) as { data: MbtaStopResource[] };
  const lower = q.toLowerCase();
  const seen = new Set<string>();
  const matches: TransitStop[] = [];
  for (const s of body.data ?? []) {
    if (seen.has(s.id)) continue;
    if (!s.attributes.name.toLowerCase().includes(lower)) continue;
    seen.add(s.id);
    matches.push({
      id: s.id,
      name: s.attributes.name,
      lat: s.attributes.latitude ?? 0,
      lon: s.attributes.longitude ?? 0,
    });
    if (matches.length >= 40) break;
  }
  return matches;
}
