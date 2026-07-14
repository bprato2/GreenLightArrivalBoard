"use client";

import type { ArrivalAlertPhase } from "@/lib/alerts/beacon";

interface ArrivalIndicatorProps {
  phase: ArrivalAlertPhase;
}

/**
 * Kiosk-visible arrival beacon. Phases map 1:1 to the webhook adapter
 * so external smart lights can mirror this light later.
 */
export function ArrivalIndicator({ phase }: ArrivalIndicatorProps) {
  if (phase === "idle") {
    return (
      <div
        className="arrival-indicator h-4 w-4 rounded-full border border-zinc-700 bg-zinc-900"
        aria-label="No arrival alert"
        title="Idle"
      />
    );
  }

  if (phase === "pulse") {
    return (
      <div
        className="arrival-indicator h-5 w-5 rounded-full bg-emerald-500 shadow-[0_0_15px_#10b981] animate-pulse"
        aria-label="Green light — leave now"
        title="Green light window (3–7 min)"
      />
    );
  }

  return (
    <div
      className="arrival-indicator h-5 w-5 rounded-full bg-emerald-400 shadow-[0_0_22px_rgba(52,211,153,1)]"
      aria-label="Train imminent"
      title="Imminent alert"
    />
  );
}
