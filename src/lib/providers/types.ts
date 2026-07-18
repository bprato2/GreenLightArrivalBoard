/**
 * Agency-agnostic contracts for transit board data providers.
 */

/** App-level transit mode (Amtrak is informational only). */
export type TransitMode = "subway" | "commuter_rail" | "bus" | "amtrak";

export type AppView = "board" | "plan";

/** Stable stop / station identity used by settings and board filters. */
export interface TransitStop {
  id: string;
  name: string;
  shortName?: string;
  lat: number;
  lon: number;
}

export interface TransitDirection {
  id: number;
  label: string;
  towardLabel: string;
}

export interface TransitRoute {
  id: string;
  label: string;
  shortName?: string;
  color: string;
  /** GTFS route type: 0 light rail, 1 heavy rail, 2 CR, 3 bus, 4 ferry. */
  type?: number;
}

/** What the board needs to render route pickers for one transit system. */
export interface TransitSystemCatalog {
  systemId: string;
  systemName: string;
  route: TransitRoute;
  directions: TransitDirection[];
  stops: TransitStop[];
  defaultStopId: string;
  defaultDirectionId: number;
}

/** Board filter passed into live/schedule data hooks. */
export interface TransitBoardFilter {
  stopId: string;
  directionId: number;
  routeId: string;
}

export const TRANSIT_MODES: { id: TransitMode; label: string }[] = [
  { id: "subway", label: "Subway" },
  { id: "commuter_rail", label: "Commuter Rail" },
  { id: "bus", label: "Bus" },
  { id: "amtrak", label: "Amtrak" },
];

/** MBTA V3 route type filter for each mode. */
export function routeTypesForMode(mode: TransitMode): number[] | null {
  switch (mode) {
    case "subway":
      return [0, 1];
    case "commuter_rail":
      return [2];
    case "bus":
      return [3];
    case "amtrak":
      return null;
  }
}

export function isTransitMode(value: unknown): value is TransitMode {
  return (
    value === "subway" ||
    value === "commuter_rail" ||
    value === "bus" ||
    value === "amtrak"
  );
}

export function isAppView(value: unknown): value is AppView {
  return value === "board" || value === "plan";
}
