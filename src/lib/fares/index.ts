/**
 * Curated MBTA adult one-way fares.
 * lastVerified: 2026-07-18 — update when MBTA publishes new rates.
 * Source: https://www.mbta.com/fares
 */

export type FareZone =
  | "1A"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10";

export interface FareEstimate {
  amountUsd: number | null;
  currency: "USD";
  fareType: string;
  zoneInfo: string | null;
  notes: string;
  officialUrl: string;
}

export const OFFICIAL_FARES_URL = "https://www.mbta.com/fares";

/** Flat rapid-transit (subway / Green / Orange / Red / Blue / Mattapan). */
export const SUBWAY_ADULT_ONE_WAY = 2.4;

/** Local bus adult one-way. */
export const LOCAL_BUS_ADULT_ONE_WAY = 1.7;

/** Inner / outer express bus adult one-way. */
export const INNER_EXPRESS_BUS = 4.25;
export const OUTER_EXPRESS_BUS = 5.25;

/**
 * Commuter Rail one-way fares from Zone 1A (Boston) to each outer zone.
 * Interzone fares use a simplified step table below.
 */
export const CR_ZONE_TO_1A: Record<FareZone, number> = {
  "1A": 2.4,
  "1": 6.5,
  "2": 7.0,
  "3": 8.0,
  "4": 8.75,
  "5": 9.75,
  "6": 10.5,
  "7": 11.0,
  "8": 12.25,
  "9": 12.75,
  "10": 13.25,
};

/** Zone number for interzone distance (1A = 0). */
const ZONE_RANK: Record<FareZone, number> = {
  "1A": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
};

/** Approximate interzone one-way by number of zones traversed (incl. origin/dest). */
const INTERZONE_BY_SPAN: Record<number, number> = {
  1: 2.4,
  2: 3.25,
  3: 4.25,
  4: 5.0,
  5: 5.75,
  6: 6.5,
  7: 7.25,
  8: 8.0,
  9: 8.75,
  10: 9.5,
};

/** Parent stop id / place-* → CR fare zone. Incomplete; unknown zones return null fare. */
export const CR_STATION_ZONES: Record<string, FareZone> = {
  "place-sstat": "1A",
  "place-bbsta": "1A",
  "place-north": "1A",
  "place-rugg": "1A",
  "place-forhl": "1A",
  "place-DB-2205": "1A", // JFK/UMass area CR if present
  "place-NHRML-0055": "1A", // Malden Center often 1A-ish — verify
  // Worcester Line
  "place-WML-0035": "1", // Lansdowne / Yawkey area
  "place-WML-0081": "1",
  "place-WML-0100": "1",
  "place-WML-0125": "2",
  "place-WML-0135": "2",
  "place-WML-0147": "2",
  "place-WML-0172": "3",
  "place-WML-0199": "3",
  "place-WML-0214": "4",
  "place-WML-0252": "4", // Ashland
  "place-WML-0274": "5", // Southborough
  "place-WML-0340": "6", // Westborough
  "place-WML-0364": "7", // Grafton
  "place-WML-0442": "8", // Worcester
  // Needham / Franklin / Providence samples
  "place-NB-0080": "1",
  "place-NB-0101": "1",
  "place-NB-0127": "2",
  "place-PB-0156": "2",
  "place-PB-0194": "3",
  "place-PB-0215": "4",
  "place-PB-0281": "6",
  "place-NEC-1659": "1A",
  "place-NEC-1768": "1",
  "place-NEC-1919": "2",
  "place-NEC-1969": "3",
  "place-NEC-2108": "4",
  "place-NEC-2130": "5",
  "place-NEC-2173": "6",
  "place-NEC-2203": "7",
  "place-NEC-2277": "8",
  "place-NEC-2287": "1A", // South Station platform child sometimes
};

const EXPRESS_ROUTE_HINTS = /express|sl\s*1|sl\s*2|sl\s*3|ct[12]/i;

export function estimateSubwayFare(): FareEstimate {
  return {
    amountUsd: SUBWAY_ADULT_ONE_WAY,
    currency: "USD",
    fareType: "Adult one-way (subway / rapid transit)",
    zoneInfo: null,
    notes: "CharlieCard, CharlieTicket, contactless, or cash. Transfers may apply.",
    officialUrl: OFFICIAL_FARES_URL,
  };
}

export function estimateBusFare(routeId: string, routeLabel?: string): FareEstimate {
  const blob = `${routeId} ${routeLabel ?? ""}`;
  const express = EXPRESS_ROUTE_HINTS.test(blob);
  const outer = /outer|ct2/i.test(blob);
  if (express) {
    const amount = outer ? OUTER_EXPRESS_BUS : INNER_EXPRESS_BUS;
    return {
      amountUsd: amount,
      currency: "USD",
      fareType: outer ? "Adult one-way (outer express bus)" : "Adult one-way (inner express bus)",
      zoneInfo: null,
      notes: "Approximate express rate; verify route fare class on mbta.com.",
      officialUrl: "https://www.mbta.com/fares/bus-fares",
    };
  }
  return {
    amountUsd: LOCAL_BUS_ADULT_ONE_WAY,
    currency: "USD",
    fareType: "Adult one-way (local bus)",
    zoneInfo: null,
    notes: "CharlieCard, CharlieTicket, contactless, or cash. Transfers may apply.",
    officialUrl: "https://www.mbta.com/fares/bus-fares",
  };
}

export function resolveCrZone(stopId: string): FareZone | null {
  if (CR_STATION_ZONES[stopId]) return CR_STATION_ZONES[stopId]!;
  // Child platform IDs sometimes contain parent slug.
  for (const [id, zone] of Object.entries(CR_STATION_ZONES)) {
    const slug = id.replace("place-", "");
    if (stopId.includes(slug)) return zone;
  }
  return null;
}

export function estimateCommuterRailFare(
  originStopId: string,
  destinationStopId: string,
): FareEstimate {
  const from = resolveCrZone(originStopId);
  const to = resolveCrZone(destinationStopId);
  if (!from || !to) {
    return {
      amountUsd: null,
      currency: "USD",
      fareType: "Commuter Rail (zone unknown)",
      zoneInfo: null,
      notes:
        "Could not map both stations to fare zones. Check the official zone fare table.",
      officialUrl: "https://www.mbta.com/fares/commuter-rail-fares/zones",
    };
  }

  let amount: number;
  let zoneInfo: string;
  if (from === "1A" || to === "1A") {
    const outer = from === "1A" ? to : from;
    amount = CR_ZONE_TO_1A[outer];
    zoneInfo = `Zone ${from} → Zone ${to}`;
  } else {
    const span = Math.abs(ZONE_RANK[from] - ZONE_RANK[to]) + 1;
    amount = INTERZONE_BY_SPAN[Math.min(10, Math.max(1, span))] ?? 6.5;
    zoneInfo = `Interzone ${from} → ${to} (~${span} zones)`;
  }

  return {
    amountUsd: amount,
    currency: "USD",
    fareType: "Adult one-way (Commuter Rail)",
    zoneInfo,
    notes: "Approximate published zone fare; mTicket / CharlieTicket prices may differ.",
    officialUrl: "https://www.mbta.com/fares/commuter-rail-fares/zones",
  };
}

export function estimateFerryFare(routeId?: string): FareEstimate {
  const innerHarbor =
    /Boat-F4|Boat-EastBoston|Charlestown|East.?Boston/i.test(routeId ?? "");
  if (innerHarbor) {
    return {
      amountUsd: 0,
      currency: "USD",
      fareType: "Inner Harbor Ferry",
      zoneInfo: null,
      notes: "Inner Harbor ferry service is typically free. Confirm on mbta.com.",
      officialUrl: "https://www.mbta.com/fares/ferry",
    };
  }
  return {
    amountUsd: null,
    currency: "USD",
    fareType: "Ferry (route-specific)",
    zoneInfo: null,
    notes:
      "Outer harbor and commuter ferry fares vary by route. Check the official ferry fare table.",
    officialUrl: "https://www.mbta.com/fares/ferry",
  };
}

export function formatFareAmount(amountUsd: number | null): string {
  if (amountUsd === null) return "See mbta.com";
  return `$${amountUsd.toFixed(2)}`;
}
