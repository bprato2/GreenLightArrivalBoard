"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyStreamEvent,
  buildPredictionsUrl,
  buildVehiclesUrl,
  deriveBoardState,
  emptyCollection,
  getApiKey,
} from "@/lib/mbta/parse";
import type { Arrival, MapTrain, StreamCollection } from "@/lib/mbta/types";

const RECONNECT_MS = 2 * 60 * 60 * 1000; // Force healthy reconnect every 2h (MBTA streams can go quiet).
const TICK_MS = 1000;

export interface UseMbtaStreamResult {
  arrivals: Arrival[];
  trains: MapTrain[];
  connected: boolean;
  error: string | null;
  lastEventAt: number | null;
  nowMs: number;
}

/**
 * Dual SSE subscription: predictions for Newton Highlands + vehicles on Green-D.
 * Maintains an in-memory JSON:API collection and derives board rows once per second
 * so countdown text stays smooth without thrashing React on every vehicle GPS tick.
 */
export function useMbtaStream(): UseMbtaStreamResult {
  const collectionRef = useRef<StreamCollection>(emptyCollection());
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [trains, setTrains] = useState<MapTrain[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [generation, setGeneration] = useState(0);

  const dirtyRef = useRef(true);
  const predOpen = useRef(false);
  const vehOpen = useRef(false);

  const syncConnected = useCallback(() => {
    setConnected(predOpen.current && vehOpen.current);
  }, []);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setLastEventAt(Date.now());
  }, []);

  useEffect(() => {
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
        markDirty();
        setError(null);
      };

      es.addEventListener("reset", handle("reset"));
      es.addEventListener("add", handle("add"));
      es.addEventListener("update", handle("update"));
      es.addEventListener("remove", handle("remove"));

      // Some environments deliver unnamed messages — treat as update/reset best-effort.
      es.onmessage = (ev) => handle("update")(ev);

      es.onopen = () => {
        onOpenFlag.current = true;
        syncConnected();
      };

      es.onerror = () => {
        onOpenFlag.current = false;
        syncConnected();
        // EventSource auto-retries; surface a soft status only.
        if (!cancelled) {
          setError((prev) => prev ?? "Reconnecting to MBTA…");
        }
      };
    };

    predOpen.current = false;
    vehOpen.current = false;
    collectionRef.current = emptyCollection();
    dirtyRef.current = true;

    attach(buildPredictionsUrl(apiKey), "prediction", predOpen);
    attach(buildVehiclesUrl(apiKey), "vehicle", vehOpen);

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
  }, [generation, markDirty, syncConnected]);

  // 1 Hz display clock — cheap countdown updates; recompute only when stream dirty or each tick.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (!dirtyRef.current && arrivals.length === 0 && trains.length === 0) {
        // Still tick minutes for existing rows
      }
      const derived = deriveBoardState(collectionRef.current, now);
      dirtyRef.current = false;
      setArrivals(derived.arrivals);
      setTrains(derived.trains);
    }, TICK_MS);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable interval
  }, []);

  return { arrivals, trains, connected, error, lastEventAt, nowMs };
}
