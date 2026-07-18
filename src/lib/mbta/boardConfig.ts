/**
 * Board route helpers — defaults, direction labels, and coercion.
 */

import type { TransitMode } from "@/lib/providers/types";
import { TARGET_STOP_ID } from "./stations";

export type DirectionId = 0 | 1;

export const GREEN_LINE_COLOR = "#00843d";
export const ROUTE_ID = "Green-D";
export const ROUTE_LABEL = "Green Line D";
export const DEFAULT_MODE: TransitMode = "subway";
export const DEFAULT_ROUTE_ID = ROUTE_ID;
export const DEFAULT_STOP_ID = TARGET_STOP_ID;

export interface DirectionOption {
  id: DirectionId;
  label: string;
  towardLabel: string;
}

export const DIRECTIONS: DirectionOption[] = [
  {
    id: 1,
    label: "Inbound",
    towardLabel: "Toward downtown / terminal",
  },
  {
    id: 0,
    label: "Outbound",
    towardLabel: "Toward outer terminal",
  },
];

export function isDirectionId(value: unknown): value is DirectionId {
  return value === 0 || value === 1;
}

export function getDirectionOption(directionId: DirectionId): DirectionOption {
  return DIRECTIONS.find((d) => d.id === directionId) ?? DIRECTIONS[0]!;
}

/** Keep direction on the known catalog; stop/route validated against live lists. */
export function coerceDirection(directionId: number): DirectionId {
  return isDirectionId(directionId) ? directionId : 1;
}

/** @deprecated Prefer coerceDirection + live stop lists. */
export function coerceRouteSelection(
  stopId: string,
  directionId: number,
): { stopId: string; directionId: DirectionId } {
  return {
    stopId: stopId || DEFAULT_STOP_ID,
    directionId: coerceDirection(directionId),
  };
}
