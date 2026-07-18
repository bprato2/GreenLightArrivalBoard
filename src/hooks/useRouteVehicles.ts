"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyStreamEvent,
  buildVehiclesUrlForRoutes,
  emptyCollection,
  getApiKey,
  relatedId,
} from "@/lib/mbta/parse";
import type { StreamCollection, VehicleResource } from "@/lib/mbta/types";

const RECONNECT_MS = 2 * 60 * 60 * 1000;
const TICK_MS = 1000;

export interface LiveVehicle {
  id: string;
  lat: number;
  lon: number;
  directionId: number;
  label: string | null;
  bearing: number | null;
  status: string;
  routeId: string | null;
}

export interface UseRouteVehiclesResult {
  vehicles: LiveVehicle[];
  connected: boolean;
  error: string | null;
}

function toLiveVehicles(collection: StreamCollection): LiveVehicle[] {
  const out: LiveVehicle[] = [];
  for (const vehicle of collection.vehicles.values()) {
    const live = fromVehicle(vehicle);
    if (live) out.push(live);
  }
  return out;
}

function fromVehicle(vehicle: VehicleResource): LiveVehicle | null {
  const { latitude, longitude, direction_id, label, bearing, current_status } =
    vehicle.attributes;
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    id: vehicle.id,
    lat: latitude,
    lon: longitude,
    directionId: direction_id ?? 0,
    label,
    bearing,
    status: current_status,
    routeId: relatedId(vehicle, "route"),
  };
}

async function fetchVehiclesSnapshot(
  apiKey: string,
  routeIds: string[],
): Promise<VehicleResource[]> {
  if (routeIds.length === 0) return [];
  const url = buildVehiclesUrlForRoutes(apiKey, routeIds);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Vehicles HTTP ${res.status}`);
  const body = (await res.json()) as { data?: VehicleResource[] };
  return body.data ?? [];
}

/**
 * Vehicles stream for one or more routes — geographic positions for the live map.
 */
export function useRouteVehicles(
  routeIds: string[],
  enabled = true,
): UseRouteVehiclesResult {
  const collectionRef = useRef<StreamCollection>(emptyCollection());
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const openRef = useRef(false);

  const routeKey = routeIds.filter(Boolean).slice().sort().join(",");

  const syncConnected = useCallback(() => {
    setConnected(openRef.current);
  }, []);

  useEffect(() => {
    if (!enabled || !routeKey) {
      setConnected(false);
      setVehicles([]);
      setError(null);
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      setError("Missing NEXT_PUBLIC_MBTA_API_KEY");
      setConnected(false);
      return;
    }

    const ids = routeKey.split(",");
    let cancelled = false;
    collectionRef.current = emptyCollection();
    setVehicles([]);
    openRef.current = false;
    setConnected(false);

    void fetchVehiclesSnapshot(apiKey, ids)
      .then((list) => {
        if (cancelled) return;
        for (const vehicle of list) {
          collectionRef.current.vehicles.set(vehicle.id, vehicle);
        }
        setVehicles(toLiveVehicles(collectionRef.current));
        setError(null);
      })
      .catch(() => {
        /* SSE may still populate */
      });

    const url = buildVehiclesUrlForRoutes(apiKey, ids);
    const es = new EventSource(url);

    const handle = (eventType: string) => (ev: MessageEvent) => {
      if (cancelled) return;
      applyStreamEvent(collectionRef.current, eventType, ev.data, "vehicle");
      setVehicles(toLiveVehicles(collectionRef.current));
      setError(null);
    };

    es.addEventListener("reset", handle("reset"));
    es.addEventListener("add", handle("add"));
    es.addEventListener("update", handle("update"));
    es.addEventListener("remove", handle("remove"));
    es.onmessage = (ev) => handle("update")(ev);

    es.onopen = () => {
      openRef.current = true;
      syncConnected();
    };

    es.onerror = () => {
      openRef.current = false;
      syncConnected();
      if (!cancelled) {
        setError((prev) => prev ?? "Reconnecting to MBTA…");
      }
    };

    const reconnectTimer = window.setTimeout(() => {
      if (!cancelled) setGeneration((g) => g + 1);
    }, RECONNECT_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(reconnectTimer);
      es.close();
      openRef.current = false;
    };
  }, [enabled, routeKey, generation, syncConnected]);

  useEffect(() => {
    if (!enabled || !routeKey) return;
    const id = window.setInterval(() => {
      setVehicles(toLiveVehicles(collectionRef.current));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled, routeKey]);

  return { vehicles, connected, error };
}
