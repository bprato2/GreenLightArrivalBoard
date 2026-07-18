"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAlertAdapter,
  type ArrivalAlertPhase,
} from "@/lib/alerts/beacon";
import type { BoardSettings } from "@/types/settings";

export interface UseArrivalAlertResult {
  phase: ArrivalAlertPhase;
  minutesAway: number | null;
  /** Force a phase for the settings "Test alert" button. */
  forcePhase: (phase: ArrivalAlertPhase) => void;
  clearForce: () => void;
}

/**
 * Three-phase alert derived from the closest ETA:
 * - idle: no train or outside pulse window
 * - pulse: green-light window
 * - imminent: arriving / boarding
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
      stationId: settings.stopId,
      stationName: settings.stopName || settings.stopId,
    });
  }, [
    phase,
    closestMinutes,
    settings.alertWebhookUrl,
    settings.stopId,
    settings.stopName,
  ]);

  return {
    phase,
    minutesAway: closestMinutes,
    forcePhase: (p) => setForced(p),
    clearForce: () => setForced(null),
  };
}
