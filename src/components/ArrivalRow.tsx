"use client";

import { motion } from "framer-motion";
import { formatMinutes } from "@/lib/format";
import type { Arrival } from "@/lib/mbta/types";

interface ArrivalRowProps {
  arrival: Arrival;
  index: number;
  glow: number;
}

export function ArrivalRow({ arrival, index, glow }: ArrivalRowProps) {
  const eta = formatMinutes(arrival.minutesAway);
  const glowPx = 4 + glow * 14;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 4) * 0.04 }}
      className="arrival-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-amber-900/25 py-2.5 px-1"
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-3">
          <span
            className="led-text text-[clamp(1.1rem,2.4vw,1.85rem)] font-semibold tracking-wide truncate"
            style={{ textShadow: `0 0 ${glowPx}px rgba(255,176,0,${0.35 + glow * 0.45})` }}
          >
            D → {arrival.headsign}
          </span>
          {arrival.isDelayed && (
            <span className="led-text text-xs uppercase tracking-[0.2em] text-orange-400/90 shrink-0">
              Delayed
            </span>
          )}
          {arrival.isApproaching && !arrival.isDelayed && (
            <span className="led-text text-xs uppercase tracking-[0.2em] text-emerald-400/90 shrink-0 animate-pulse">
              Approaching
            </span>
          )}
        </div>
        {arrival.locationLabel && (
          <div
            className="led-text mt-0.5 text-[clamp(0.75rem,1.4vw,1rem)] text-amber-500/70 truncate"
            style={{ textShadow: `0 0 ${glowPx * 0.5}px rgba(255,176,0,0.25)` }}
          >
            {arrival.locationLabel}
          </div>
        )}
      </div>

      <div className="text-right shrink-0">
        <div
          className={`led-text tabular-nums font-bold tracking-wider ${
            arrival.minutesAway <= 0
              ? "text-emerald-400 text-[clamp(1.4rem,3vw,2.2rem)]"
              : "text-[clamp(1.35rem,2.8vw,2.1rem)]"
          }`}
          style={{
            textShadow:
              arrival.minutesAway <= 0
                ? `0 0 ${glowPx}px rgba(52,211,153,${0.5 + glow * 0.4})`
                : `0 0 ${glowPx}px rgba(255,176,0,${0.4 + glow * 0.4})`,
          }}
        >
          {eta}
        </div>
      </div>
    </motion.div>
  );
}
