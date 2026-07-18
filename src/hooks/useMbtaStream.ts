"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyStreamEvent,
  buildPredictionsUrl,
  buildVehiclesUrl,
  deriveBoardState,
  emptyCollection,
  getApiKey,
  type BoardFilter,
} from "@/lib/mbta/parse";
import type { Arrival, MapTrain, StreamCollection } from "@/lib/mbta/types";

const RECONNECT_MS = 2 * 60 * 60 * 1000;
const TICK_MS = 1000;

export interface UseMbtaStreamResult {
  arrivals: Arrival[];
  trains: MapTrain[];
  connected: boolean;
  error: string | null;
  lastEventAt: number | null;
  nowMs: number;
}

export interface UseMbtaStreamOptions {
  routeColor?: string;
  /** When false, skip connecting (e.g. Amtrak mode). */
  enabled?: boolean;
}

/**
 * Dual SSE subscription: predictions for the selected stop + vehicles on the route.
 */
export function useMbtaStream(
  filter: BoardFilter,
  options: UseMbtaStreamOptions = {},
): UseMbtaStreamResult {
  const { routeColor = "#00843d", enabled = true } = options;
  const collectionRef = useRef<StreamCollection>(emptyCollection());
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const colorRef = useRef(routeColor);
  colorRef.current = routeColor;
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [trains, setTrains] = useState<MapTrain[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [generation, setGeneration] = useState(0);

  const predOpen = useRef(false);
  const vehOpen = useRef(false);

  const syncConnected = useCallback(() => {
    setConnected(predOpen.current && vehOpen.current);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      setArrivals([]);
      setTrains([]);
      setError(null);
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      setError("Missing NEXT_PUBLIC_MBTA_API_KEY");
      setConnected(false);
      return;
    }

    let cancelled = false;
    const sources: EventSource[] = [];

    const attach = (
      url: string,
      primaryType: "prediction" | "vehicle",
      onOpenFlag: { current: boolean },
    ) => {
      const es = new EventSource(url);
      sources.push(es);

      const handle = (eventType: string) => (ev: MessageEvent) => {
        if (cancelled) return;
        applyStreamEvent(collectionRef.current, eventType, ev.data, primaryType);
        setLastEventAt(Date.now());
        setError(null);
      };

      es.addEventListener("reset", handle("reset"));
      es.addEventListener("add", handle("add"));
      es.addEventListener("update", handle("update"));
      es.addEventListener("remove", handle("remove"));
      es.onmessage = (ev) => handle("update")(ev);

      es.onopen = () => {
        onOpenFlag.current = true;
        syncConnected();
      };

      es.onerror = () => {
        onOpenFlag.current = false;
        syncConnected();
        if (!cancelled) {
          setError((prev) => prev ?? "Reconnecting to MBTA…");
        }
      };
    };

    predOpen.current = false;
    vehOpen.current = false;
    collectionRef.current = emptyCollection();
    setArrivals([]);
    setTrains([]);

    attach(buildPredictionsUrl(apiKey, filter), "prediction", predOpen);
    attach(buildVehiclesUrl(apiKey, filter.routeId), "vehicle", vehOpen);

    const reconnectTimer = window.setTimeout(() => {
      if (!cancelled) setGeneration((g) => g + 1);
    }, RECONNECT_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(reconnectTimer);
      for (const es of sources) es.close();
      predOpen.current = false;
      vehOpen.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [
    enabled,
    filter.stopId,
    filter.directionId,
    filter.routeId,
    generation,
    syncConnected,
  ]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      const derived = deriveBoardState(
        collectionRef.current,
        now,
        filterRef.current,
        colorRef.current,
      );
      setArrivals(derived.arrivals);
      setTrains(derived.trains);
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [enabled]);

  return { arrivals, trains, connected, error, lastEventAt, nowMs };
}
