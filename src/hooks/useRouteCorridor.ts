"use client";

import { useEffect, useState } from "react";
import {
  fetchLineStations,
  getCorridorWindow,
  type MiniMapCorridor,
} from "@/lib/mbta/corridor";
import type { StationInfo } from "@/lib/mbta/stations";

export interface UseRouteCorridorResult {
  corridor: MiniMapCorridor | null;
  line: StationInfo[];
  loading: boolean;
  error: string | null;
}

/**
 * Load the selected route's ordered stations and window them for the mini-map.
 */
export function useRouteCorridor(
  routeId: string,
  stopId: string,
  directionId: number,
  enabled = true,
): UseRouteCorridorResult {
  const [line, setLine] = useState<StationInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !routeId) {
      setLine([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchLineStations(routeId, stopId)
      .then((stations) => {
        if (cancelled) return;
        setLine(stations);
      })
      .catch(() => {
        if (!cancelled) {
          setLine([]);
          setError("Could not load line map");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, routeId, stopId]);

  const corridor =
    enabled && stopId && line.length > 0
      ? getCorridorWindow(line, stopId, directionId)
      : null;

  return { corridor, line, loading, error };
}
