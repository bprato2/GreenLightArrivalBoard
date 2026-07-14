"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAlertAdapter,
  type ArrivalAlertPhase,
} from "@/lib/alerts/beacon";
import { TARGET_STATION_NAME, TARGET_STOP_ID } from "@/lib/mbta/stations";
import type { BoardSettings } from "@/types/settings";

export interface UseArrivalAlertResult {
  phase: ArrivalAlertPhase;
  minutesAway: number | null;
  /** Force a phase for the settings "Test alert" button. */
  forcePhase: (phase: ArrivalAlertPhase) => void;
  clearForce: () => void;
}

/**
 * Three-phase alert derived from the closest inbound ETA:
 * - idle (phase 0): no train or > 7 min away
 * - pulse (phase 1): green-light window, 3–7 min inclusive
 * - imminent (phase 2): arriving / boarding, 0–2 min inclusive
 */
export function useArrivalAlert(
  closestInboundMinutes: number | null,
  settings: BoardSettings,
): UseArrivalAlertResult {
  const [forced, setForced] = useState<ArrivalAlertPhase | null>(null);
  const lastPhase = useRef<ArrivalAlertPhase | null>(null);

  const computed = useMemo((): ArrivalAlertPhase => {
    if (closestInboundMinutes === null) return "idle";
    if (closestInboundMinutes <= settings.alertImminentMinutes) return "imminent";
    if (
      closestInboundMinutes >= settings.alertPulseMinMinutes &&
      closestInboundMinutes <= settings.alertPulseMaxMinutes
    ) {
      return "pulse";
    }
    return "idle";
  }, [
    closestInboundMinutes,
    settings.alertImminentMinutes,
    settings.alertPulseMaxMinutes,
    settings.alertPulseMinMinutes,
  ]);

  const phase = forced ?? computed;

  useEffect(() => {
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    const adapter = createAlertAdapter(settings.alertWebhookUrl);
    void adapter.onPhaseChange({
      phase,
      minutesAway: closestInboundMinutes,
      at: new Date().toISOString(),
      stationId: TARGET_STOP_ID,
      stationName: TARGET_STATION_NAME,
    });
  }, [phase, closestInboundMinutes, settings.alertWebhookUrl]);

  return {
    phase,
    minutesAway: closestInboundMinutes,
    forcePhase: (p) => setForced(p),
    clearForce: () => setForced(null),
  };
}
