"use client";

import { useEffect, useRef, useState } from "react";
import { deriveScheduledArrivals } from "@/lib/mbta/schedules";
import { getApiKey } from "@/lib/mbta/parse";
import { getSchedules } from "@/lib/mbta/scheduleCache";
import type { DirectionId } from "@/lib/mbta/boardConfig";
import type { Arrival, ScheduleResource } from "@/lib/mbta/types";

const REFRESH_MS = 5 * 60 * 1000;

export interface UseMbtaSchedulesResult {
  scheduled: Arrival[];
  schedules: ScheduleResource[];
}

export function useMbtaSchedules(
  liveArrivals: Arrival[],
  nowMs: number,
  stopId: string,
  directionId: DirectionId,
  routeId: string,
  routeColor: string,
  enabled = true,
): UseMbtaSchedulesResult {
  const [scheduled, setScheduled] = useState<Arrival[]>([]);
  const [schedules, setSchedules] = useState<ScheduleResource[]>([]);
  const tripsRef = useRef(new Map<string, { headsign: string }>());
  const schedulesRef = useRef<ScheduleResource[]>([]);
  const liveRef = useRef(liveArrivals);
  const directionRef = useRef(directionId);
  const routeIdRef = useRef(routeId);
  const colorRef = useRef(routeColor);

  liveRef.current = liveArrivals;
  directionRef.current = directionId;
  routeIdRef.current = routeId;
  colorRef.current = routeColor;

  useEffect(() => {
    if (!enabled) {
      setScheduled([]);
      setSchedules([]);
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) return;

    let cancelled = false;

    const load = async () => {
      try {
        const result = await getSchedules(apiKey, stopId, directionId, routeId);
        if (cancelled) return;
        tripsRef.current = result.trips;
        schedulesRef.current = result.schedules;
        setSchedules(result.schedules);
        setScheduled(
          deriveScheduledArrivals(
            result.schedules,
            result.trips,
            liveRef.current,
            Date.now(),
            2,
            directionId,
            routeColor,
            routeId,
          ),
        );
      } catch {
        /* keep last good schedule data */
      }
    };

    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [stopId, directionId, routeId, routeColor, enabled]);

  useEffect(() => {
    if (!enabled) return;
    setScheduled(
      deriveScheduledArrivals(
        schedulesRef.current,
        tripsRef.current,
        liveArrivals,
        nowMs,
        2,
        directionRef.current,
        colorRef.current,
        routeIdRef.current,
      ),
    );
  }, [liveArrivals, nowMs, enabled]);

  return { scheduled, schedules };
}
