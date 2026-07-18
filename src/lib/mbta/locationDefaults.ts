/**
 * First-visit route defaults from the device's approximate location.
 * Picks the closest Green Line D station; direction defaults to inbound.
 */

import { coerceRouteSelection, type DirectionId } from "@/lib/mbta/boardConfig";
import { GREEN_D_STATIONS, TARGET_STOP_ID } from "@/lib/mbta/stations";
import { haversineMeters, type StationCoords } from "@/lib/walk";

export interface LocationRouteDefaults {
  stopId: string;
  directionId: DirectionId;
}

export function findClosestStationId(from: StationCoords): string {
  let bestId = TARGET_STOP_ID;
  let bestMeters = Number.POSITIVE_INFINITY;

  for (const station of GREEN_D_STATIONS) {
    const meters = haversineMeters(from, { lat: station.lat, lon: station.lon });
    if (meters < bestMeters) {
      bestMeters = meters;
      bestId = station.id;
    }
  }

  return bestId;
}

export function routeDefaultsFromLocation(coords: StationCoords): LocationRouteDefaults {
  const closest = findClosestStationId(coords);
  return coerceRouteSelection(closest, 1);
}

/**
 * One-shot geolocation for first-visit defaults.
 * Resolves null when unsupported, denied, or timed out.
 */
export function detectLocationRouteDefaults(): Promise<LocationRouteDefaults | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve(
          routeDefaultsFromLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          }),
        );
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 5 * 60_000,
      },
    );
  });
}
