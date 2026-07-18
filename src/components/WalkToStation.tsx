"use client";

import { formatWalkDistance } from "@/lib/walk";
import type { WalkToStationState } from "@/hooks/useWalkToStation";
import { stationDisplayName } from "@/lib/mbta/stations";

interface WalkToStationProps {
  stationId: string;
  walk: WalkToStationState;
  /** Prefer cached display name when station is not on Green-D. */
  stationName?: string;
}

/**
 * Compact control: shows estimated walking time to the selected station.
 * Tap to refresh.
 */
export function WalkToStation({ stationId, walk, stationName }: WalkToStationProps) {
  const { status, estimate, error, check } = walk;
  const name = stationName || stationDisplayName(stationId);

  let value: string;
  if (status === "locating") {
    value = "Locating…";
  } else if (status === "ready" && estimate) {
    value =
      estimate.minutes === 0
        ? `At ${name}`
        : `~${estimate.minutes} min · ${formatWalkDistance(estimate.miles)}`;
  } else if (status === "error" && error) {
    value = error;
  } else {
    value = "Check";
  }

  const busy = status === "locating";

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (busy) return;
        check();
      }}
      title={
        status === "ready"
          ? `Estimated walk to ${name}. Tap to refresh.`
          : status === "error"
            ? `${error}. Tap to try again.`
            : `Estimate walking time to ${name}`
      }
      aria-live="polite"
      className={`flex shrink-0 flex-col items-start gap-0.5 rounded border px-2 py-1 transition-colors disabled:opacity-60 ${
        status === "ready"
          ? "border-emerald-700/60 hover:border-emerald-500"
          : status === "error"
            ? "border-amber-800/70 hover:border-amber-600"
            : "border-amber-900/50 hover:border-amber-500"
      }`}
    >
      <span className="led-text text-[0.55rem] uppercase tracking-[0.2em] text-amber-700/80">
        Walk time
      </span>
      <span
        className={`led-text text-[0.65rem] uppercase tracking-[0.14em] ${
          status === "ready"
            ? "text-emerald-400"
            : status === "error"
              ? "text-amber-600"
              : "text-amber-200"
        }`}
      >
        {value}
      </span>
    </button>
  );
}
