"use client";

import { useEffect, useRef, useState } from "react";
import {
  deriveScheduledArrivals,
  fetchInboundSchedules,
} from "@/lib/mbta/schedules";
import { getApiKey } from "@/lib/mbta/parse";
import type { Arrival, ScheduleResource } from "@/lib/mbta/types";

const REFRESH_MS = 5 * 60 * 1000;

/**
 * Polls MBTA schedules for the next inbound departures at Newton Highlands.
 * Refreshes every 5 minutes; rows are merged with live predictions in the board.
 */
export function useMbtaSchedules(liveArrivals: Arrival[], nowMs: number): Arrival[] {
  const [scheduled, setScheduled] = useState<Arrival[]>([]);
  const tripsRef = useRef(new Map<string, { headsign: string }>());
  const schedulesRef = useRef<ScheduleResource[]>([]);
  const liveRef = useRef(liveArrivals);

  liveRef.current = liveArrivals;

  useEffect(() => {
    const apiKey = getApiKey();
    if (!apiKey) return;

    let cancelled = false;

    const load = async () => {
      try {
        const result = await fetchInboundSchedules(apiKey);
        if (cancelled) return;
        tripsRef.current = result.trips;
        schedulesRef.current = result.schedules;
        setScheduled(
          deriveScheduledArrivals(
            result.schedules,
            result.trips,
            liveRef.current,
            Date.now(),
            2,
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
  }, []);

  useEffect(() => {
    setScheduled(
      deriveScheduledArrivals(
        schedulesRef.current,
        tripsRef.current,
        liveArrivals,
        nowMs,
        2,
      ),
    );
  }, [liveArrivals, nowMs]);

  return scheduled;
}
