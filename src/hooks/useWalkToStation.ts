"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  estimateWalk,
  getStationCoords,
  type StationCoords,
  type WalkEstimate,
} from "@/lib/walk";

export type WalkStatus = "idle" | "locating" | "ready" | "error";

export interface UseWalkToStationOptions {
  auto?: boolean;
  refreshMs?: number;
  /** Prefer these coords when the station is not in the static Green-D table. */
  coords?: StationCoords | null;
}

export interface WalkToStationState {
  status: WalkStatus;
  estimate: WalkEstimate | null;
  error: string | null;
  check: () => void;
  clear: () => void;
}

const DEFAULT_REFRESH_MS = 5 * 60_000;

function geolocationErrorMessage(code: number): string {
  if (code === 1) return "Location permission denied";
  if (code === 2) return "Location unavailable";
  if (code === 3) return "Location timed out";
  return "Could not get location";
}

export function useWalkToStation(
  stationId: string,
  options: UseWalkToStationOptions = {},
): WalkToStationState {
  const { auto = false, refreshMs = DEFAULT_REFRESH_MS, coords = null } = options;
  const [status, setStatus] = useState<WalkStatus>("idle");
  const [estimate, setEstimate] = useState<WalkEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchStation = useRef(stationId);
  watchStation.current = stationId;
  const coordsRef = useRef(coords);
  coordsRef.current = coords;
  const inFlight = useRef(false);

  const clear = useCallback(() => {
    setStatus("idle");
    setEstimate(null);
    setError(null);
  }, []);

  const resolveDest = useCallback((): StationCoords | null => {
    if (
      coordsRef.current &&
      (coordsRef.current.lat !== 0 || coordsRef.current.lon !== 0)
    ) {
      return coordsRef.current;
    }
    return getStationCoords(watchStation.current);
  }, []);

  const check = useCallback(() => {
    const dest = resolveDest();
    if (!dest) {
      setStatus("error");
      setEstimate(null);
      setError("Station location unknown");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setEstimate(null);
      setError("Geolocation not supported");
      return;
    }

    if (inFlight.current) return;
    inFlight.current = true;

    setStatus("locating");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        inFlight.current = false;
        if (watchStation.current !== stationId) return;
        const target = resolveDest();
        if (!target) {
          setStatus("error");
          setEstimate(null);
          setError("Station location unknown");
          return;
        }
        const next = estimateWalk(
          { lat: pos.coords.latitude, lon: pos.coords.longitude },
          target,
        );
        setEstimate(next);
        setStatus("ready");
      },
      (err) => {
        inFlight.current = false;
        setStatus("error");
        setEstimate(null);
        setError(geolocationErrorMessage(err.code));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60_000,
      },
    );
  }, [stationId, resolveDest]);

  useEffect(() => {
    setStatus("idle");
    setEstimate(null);
    setError(null);
    inFlight.current = false;
  }, [stationId, coords?.lat, coords?.lon]);

  useEffect(() => {
    if (!auto) return;
    check();
    const id = window.setInterval(check, refreshMs);
    return () => window.clearInterval(id);
  }, [auto, check, refreshMs]);

  return { status, estimate, error, check, clear };
}
