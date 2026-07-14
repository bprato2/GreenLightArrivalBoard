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
 * Derives pulse / imminent / idle from the closest inbound ETA and
 * notifies the pluggable beacon adapter only on phase transitions.
 */
export function useArrivalAlert(
  closestMinutes: number | null,
  settings: BoardSettings,
): UseArrivalAlertResult {
  const [forced, setForced] = useState<ArrivalAlertPhase | null>(null);
  const lastPhase = useRef<ArrivalAlertPhase | null>(null);

  const computed = useMemo((): ArrivalAlertPhase => {
    if (closestMinutes === null) return "idle";
    if (closestMinutes <= settings.alertImminentMinutes) return "imminent";
    if (
      closestMinutes >= settings.alertPulseMinMinutes &&
      closestMinutes <= settings.alertPulseMaxMinutes
    ) {
      return "pulse";
    }
    return "idle";
  }, [
    closestMinutes,
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
      minutesAway: closestMinutes,
      at: new Date().toISOString(),
      stationId: TARGET_STOP_ID,
      stationName: TARGET_STATION_NAME,
    });
  }, [phase, closestMinutes, settings.alertWebhookUrl]);

  return {
    phase,
    minutesAway: closestMinutes,
    forcePhase: (p) => setForced(p),
    clearForce: () => setForced(null),
  };
}
