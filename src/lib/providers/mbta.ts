/**
 * MBTA provider catalog — default Green Line D entry point.
 */

import {
  DIRECTIONS,
  GREEN_LINE_COLOR,
  ROUTE_ID,
  ROUTE_LABEL,
} from "@/lib/mbta/boardConfig";
import { GREEN_D_STATIONS, TARGET_STOP_ID } from "@/lib/mbta/stations";
import type { TransitSystemCatalog } from "@/lib/providers/types";

export const MBTA_SYSTEM_ID = "mbta";

export const mbtaGreenLineDCatalog: TransitSystemCatalog = {
  systemId: MBTA_SYSTEM_ID,
  systemName: "MBTA",
  route: {
    id: ROUTE_ID,
    label: ROUTE_LABEL,
    color: GREEN_LINE_COLOR,
    type: 0,
  },
  directions: DIRECTIONS.map((d) => ({
    id: d.id,
    label: d.label,
    towardLabel: d.towardLabel,
  })),
  stops: GREEN_D_STATIONS.map((s) => ({
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    lat: s.lat,
    lon: s.lon,
  })),
  defaultStopId: TARGET_STOP_ID,
  defaultDirectionId: 1,
};

export function getActiveTransitCatalog(): TransitSystemCatalog {
  return mbtaGreenLineDCatalog;
}
