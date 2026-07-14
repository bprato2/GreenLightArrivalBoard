/**
 * Green Line D branch stations ordered Riverside → Government Center.
 * Stop parent (place-*) IDs match MBTA V3 `filter[stop]` / vehicle stop refs.
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
  { id: "place-rvrwy", name: "Reservoir", shortName: "Reservoir", index: 7 },
  { id: "place-bcnfd", name: "Beaconsfield", shortName: "Beaconsfld", index: 8 },
  { id: "place-brkhl", name: "Brookline Hills", shortName: "Brk Hills", index: 9 },
  { id: "place-bvmnl", name: "Brookline Village", shortName: "Brk Village", index: 10 },
  { id: "place-fenwy", name: "Fenway", shortName: "Fenway", index: 11 },
  { id: "place-kencl", name: "Kenmore", shortName: "Kenmore", index: 12 },
  { id: "place-hymnl", name: "Hynes Convention Center", shortName: "Hynes", index: 13 },
  { id: "place-coecl", name: "Copley", shortName: "Copley", index: 14 },
  { id: "place-armnl", name: "Arlington", shortName: "Arlington", index: 15 },
  { id: "place-boyls", name: "Boylston", shortName: "Boylston", index: 16 },
  { id: "place-pktrm", name: "Park Street", shortName: "Park St", index: 17 },
  { id: "place-gover", name: "Government Center", shortName: "Gov Ctr", index: 18 },
];

export const TARGET_STOP_ID = "place-newtn";
export const TARGET_STATION_NAME = "Newton Highlands";
export const ROUTE_ID = "Green-D";
/** Eastbound / inbound toward Government Center. */
export const INBOUND_DIRECTION_ID = "1";

const byId = new Map(GREEN_D_STATIONS.map((s) => [s.id, s]));
const byName = new Map(
  GREEN_D_STATIONS.flatMap((s) => [
    [s.name.toLowerCase(), s],
    [s.shortName.toLowerCase(), s],
  ]),
);

/** Resolve a place-* id, child stop id (e.g. 70170), or name to a known D station. */
export function resolveStation(
  stopIdOrName: string | null | undefined,
): StationInfo | null {
  if (!stopIdOrName) return null;
  const direct = byId.get(stopIdOrName);
  if (direct) return direct;

  // Child platform IDs often start with the parent place id pattern; walk known parents.
  for (const station of GREEN_D_STATIONS) {
    if (stopIdOrName.startsWith(station.id.replace("place-", ""))) {
      return station;
    }
  }

  return byName.get(stopIdOrName.toLowerCase()) ?? null;
}

export function stationIndex(stopId: string | null | undefined): number | null {
  return resolveStation(stopId)?.index ?? null;
}

export function stationName(stopId: string | null | undefined): string | null {
  return resolveStation(stopId)?.name ?? null;
}
