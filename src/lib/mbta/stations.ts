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
}

export const GREEN_D_STATIONS: StationInfo[] = [
  { id: "place-river", name: "Riverside", shortName: "Riverside", index: 0 },
  { id: "place-woodl", name: "Woodland", shortName: "Woodland", index: 1 },
  { id: "place-waban", name: "Waban", shortName: "Waban", index: 2 },
  { id: "place-eliot", name: "Eliot", shortName: "Eliot", index: 3 },
  { id: "place-newtn", name: "Newton Highlands", shortName: "N. Highlands", index: 4 },
  { id: "place-newto", name: "Newton Centre", shortName: "N. Centre", index: 5 },
  { id: "place-chhil", name: "Chestnut Hill", shortName: "Chestnut Hl", index: 6 },
  { id: "place-rsmnl", name: "Reservoir", shortName: "Reservoir", index: 7 },
  { id: "place-bcnfd", name: "Beaconsfield", shortName: "Beaconsfld", index: 8 },
  { id: "place-brkhl", name: "Brookline Hills", shortName: "Brk Hills", index: 9 },
  { id: "place-bvmnl", name: "Brookline Village", shortName: "Brk Village", index: 10 },
  { id: "place-longw", name: "Longwood", shortName: "Longwood", index: 11 },
  { id: "place-fenwy", name: "Fenway", shortName: "Fenway", index: 12 },
  { id: "place-kencl", name: "Kenmore", shortName: "Kenmore", index: 13 },
  { id: "place-hymnl", name: "Hynes Convention Center", shortName: "Hynes", index: 14 },
  { id: "place-coecl", name: "Copley", shortName: "Copley", index: 15 },
  { id: "place-armnl", name: "Arlington", shortName: "Arlington", index: 16 },
  { id: "place-boyls", name: "Boylston", shortName: "Boylston", index: 17 },
  { id: "place-pktrm", name: "Park Street", shortName: "Park St", index: 18 },
  { id: "place-gover", name: "Government Center", shortName: "Gov Ctr", index: 19 },
];

export const TARGET_STOP_ID = "place-newtn";
export const TARGET_STATION_NAME = "Newton Highlands";
export const ROUTE_ID = "Green-D";
/** Eastbound / inbound toward downtown (Government Center / Union Square). */
export const INBOUND_DIRECTION_ID = "1";

/** Western segment shown on the mini-map (Riverside → Newton Highlands). */
export const MINI_MAP_STATIONS: StationInfo[] = GREEN_D_STATIONS.slice(0, 5);
export const MINI_MAP_MAX_STATION_INDEX =
  MINI_MAP_STATIONS[MINI_MAP_STATIONS.length - 1]!.index;

const byId = new Map(GREEN_D_STATIONS.map((s) => [s.id, s]));
const byName = new Map(
  GREEN_D_STATIONS.flatMap((s) => [
    [s.name.toLowerCase(), s],
    [s.shortName.toLowerCase(), s],
  ]),
);

/** Resolve a place-* id, child stop id, or name to a known D station. */
export function resolveStation(
  stopIdOrName: string | null | undefined,
): StationInfo | null {
  if (!stopIdOrName) return null;
  const direct = byId.get(stopIdOrName);
  if (direct) return direct;

  const byExactName = byName.get(stopIdOrName.toLowerCase());
  if (byExactName) return byExactName;

  // Child platform IDs sometimes encode the place slug (e.g. node-newto-…).
  for (const station of GREEN_D_STATIONS) {
    const slug = station.id.replace("place-", "");
    if (stopIdOrName.includes(slug)) return station;
  }

  return null;
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
  // MBTA sometimes appends platform text; match longest prefix.
  for (const station of GREEN_D_STATIONS) {
    if (name.toLowerCase().startsWith(station.name.toLowerCase())) return station;
  }
  return null;
}
