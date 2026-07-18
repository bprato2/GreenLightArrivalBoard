/**
 * Green Line D branch stations ordered Riverside → downtown core.
 * Parent `place-*` IDs match MBTA V3 stop filters / vehicle stop refs.
 */
export interface StationInfo {
  id: string;
  name: string;
  shortName: string;
  /** Index along the D branch (0 = Riverside). */
  index: number;
  /** Approximate coordinates for map interpolation. */
  lat: number;
  lon: number;
  /** Typical minutes to the next station toward downtown (last stop = 0). */
  minutesToNext: number;
}

export const GREEN_D_STATIONS: StationInfo[] = [
  { id: "place-river", name: "Riverside", shortName: "Riverside", index: 0, lat: 42.337, lon: -71.2527, minutesToNext: 2 },
  { id: "place-woodl", name: "Woodland", shortName: "Woodland", index: 1, lat: 42.333, lon: -71.2445, minutesToNext: 2 },
  { id: "place-waban", name: "Waban", shortName: "Waban", index: 2, lat: 42.3259, lon: -71.2304, minutesToNext: 2 },
  { id: "place-eliot", name: "Eliot", shortName: "Eliot", index: 3, lat: 42.319, lon: -71.2165, minutesToNext: 2 },
  { id: "place-newtn", name: "Newton Highlands", shortName: "N. Highlands", index: 4, lat: 42.3222, lon: -71.2054, minutesToNext: 2 },
  { id: "place-newto", name: "Newton Centre", shortName: "N. Centre", index: 5, lat: 42.3297, lon: -71.1926, minutesToNext: 3 },
  { id: "place-chhil", name: "Chestnut Hill", shortName: "Chestnut Hl", index: 6, lat: 42.3368, lon: -71.1647, minutesToNext: 2 },
  { id: "place-rsmnl", name: "Reservoir", shortName: "Reservoir", index: 7, lat: 42.3351, lon: -71.1486, minutesToNext: 2 },
  { id: "place-bcnfd", name: "Beaconsfield", shortName: "Beaconsfld", index: 8, lat: 42.3357, lon: -71.1403, minutesToNext: 2 },
  { id: "place-brkhl", name: "Brookline Hills", shortName: "Brk Hills", index: 9, lat: 42.3313, lon: -71.1267, minutesToNext: 2 },
  { id: "place-bvmnl", name: "Brookline Village", shortName: "Brk Village", index: 10, lat: 42.3326, lon: -71.1165, minutesToNext: 2 },
  { id: "place-longw", name: "Longwood", shortName: "Longwood", index: 11, lat: 42.3417, lon: -71.1097, minutesToNext: 2 },
  { id: "place-fenwy", name: "Fenway", shortName: "Fenway", index: 12, lat: 42.3454, lon: -71.1043, minutesToNext: 2 },
  { id: "place-kencl", name: "Kenmore", shortName: "Kenmore", index: 13, lat: 42.3489, lon: -71.0952, minutesToNext: 2 },
  { id: "place-hymnl", name: "Hynes Convention Center", shortName: "Hynes", index: 14, lat: 42.3479, lon: -71.0879, minutesToNext: 2 },
  { id: "place-coecl", name: "Copley", shortName: "Copley", index: 15, lat: 42.3499, lon: -71.0774, minutesToNext: 2 },
  { id: "place-armnl", name: "Arlington", shortName: "Arlington", index: 16, lat: 42.3517, lon: -71.0709, minutesToNext: 1 },
  { id: "place-boyls", name: "Boylston", shortName: "Boylston", index: 17, lat: 42.353, lon: -71.0646, minutesToNext: 1 },
  { id: "place-pktrm", name: "Park Street", shortName: "Park St", index: 18, lat: 42.3564, lon: -71.0624, minutesToNext: 2 },
  { id: "place-gover", name: "Government Center", shortName: "Gov Ctr", index: 19, lat: 42.3597, lon: -71.0592, minutesToNext: 0 },
];

/** Default board stop (legacy single-station kiosk). */
export const TARGET_STOP_ID = "place-newtn";
export const TARGET_STATION_NAME = "Newton Highlands";
export const ROUTE_ID = "Green-D";
/** Eastbound / inbound toward downtown (Government Center / Union Square). */
export const INBOUND_DIRECTION_ID = "1";

/** Sum of leg minutes from home stop to the last corridor station (toward downtown). */
export function minutesFromHomeAlongCorridor(
  stations: StationInfo[],
  homeStopId: string,
): number {
  const homeIdx = stations.findIndex((s) => s.id === homeStopId);
  if (homeIdx < 0) return 0;
  let total = 0;
  for (let i = homeIdx; i < stations.length - 1; i++) {
    total += stations[i]!.minutesToNext;
  }
  return total;
}

const byId = new Map(GREEN_D_STATIONS.map((s) => [s.id, s]));
const byName = new Map(
  GREEN_D_STATIONS.flatMap((s) => [
    [s.name.toLowerCase(), s],
    [s.shortName.toLowerCase(), s],
  ]),
);

/**
 * Mini-map corridor centered on the selected departure stop (Green-D static table).
 * Prefer getCorridorWindow from `@/lib/mbta/corridor` for arbitrary routes.
 */
export function getMiniMapCorridor(
  stopId: string,
  directionId: number = 1,
): {
  stations: StationInfo[];
  hasContinuation: boolean;
  maxStationIndex: number;
  homeStopId: string;
} {
  const home = resolveStation(stopId) ?? byId.get(TARGET_STOP_ID)!;
  const homeIdx = home.index;
  const before = 5;
  const after = 1;
  const start =
    directionId === 1
      ? Math.max(0, homeIdx - before)
      : Math.max(0, homeIdx - after);
  const end =
    directionId === 1
      ? Math.min(GREEN_D_STATIONS.length - 1, homeIdx + after)
      : Math.min(GREEN_D_STATIONS.length - 1, homeIdx + before);
  const stations = GREEN_D_STATIONS.slice(start, end + 1);
  return {
    stations,
    hasContinuation: end < GREEN_D_STATIONS.length - 1,
    maxStationIndex: stations[stations.length - 1]!.index,
    homeStopId: home.id,
  };
}

/** @deprecated Prefer getMiniMapCorridor(TARGET_STOP_ID). */
export const MINI_MAP_STATIONS: StationInfo[] = getMiniMapCorridor(TARGET_STOP_ID).stations;
/** @deprecated Prefer getMiniMapCorridor(...).maxStationIndex */
export const MINI_MAP_MAX_STATION_INDEX =
  MINI_MAP_STATIONS[MINI_MAP_STATIONS.length - 1]!.index;
/** @deprecated Prefer getMiniMapCorridor(...).hasContinuation */
export const MINI_MAP_HAS_CONTINUATION = true;

/** Resolve a place-* id, child stop id, or name to a known D station. */
export function resolveStation(
  stopIdOrName: string | null | undefined,
): StationInfo | null {
  if (!stopIdOrName) return null;
  const direct = byId.get(stopIdOrName);
  if (direct) return direct;

  const byExactName = byName.get(stopIdOrName.toLowerCase());
  if (byExactName) return byExactName;

  for (const station of GREEN_D_STATIONS) {
    const slug = station.id.replace("place-", "");
    if (stopIdOrName.includes(slug)) return station;
  }

  return null;
}

export function stationDisplayName(stopId: string): string {
  return resolveStation(stopId)?.name ?? stopId;
}

export function stationIndex(stopId: string | null | undefined): number | null {
  return resolveStation(stopId)?.index ?? null;
}

export function stationName(stopId: string | null | undefined): string | null {
  return resolveStation(stopId)?.name ?? null;
}

/** Match a human stop name (from MBTA stop attributes) to a D station. */
export function resolveStationByName(name: string | null | undefined): StationInfo | null {
  if (!name) return null;
  const exact = byName.get(name.toLowerCase());
  if (exact) return exact;
  for (const station of GREEN_D_STATIONS) {
    if (name.toLowerCase().startsWith(station.name.toLowerCase())) return station;
  }
  return null;
}
