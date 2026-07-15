"use client";

import { motion } from "framer-motion";
import { MarqueeText } from "@/components/MarqueeText";
import { formatMinutes, formatScheduledTime } from "@/lib/format";
import { formatMbtaHeadsign } from "@/lib/mbta/headsign";
import type { Arrival } from "@/lib/mbta/types";

interface ArrivalRowProps {
  arrival: Arrival;
  index: number;
  glow: number;
}

export function ArrivalRow({ arrival, index, glow }: ArrivalRowProps) {
  const isScheduled = arrival.rowKind === "scheduled";
  const eta = isScheduled
    ? formatScheduledTime(arrival.etaMs)
    : formatMinutes(arrival.minutesAway);
  const glowPx = 4 + glow * 14;
  const headsign = formatMbtaHeadsign(arrival.headsign);
  const primaryText = `INB, ${headsign}`;

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
        {isScheduled && (
          <div className="led-text mb-0.5 text-[0.6rem] uppercase tracking-[0.28em] text-amber-600/70">
            Next scheduled
          </div>
        )}
        <div className="flex min-w-0 items-baseline gap-3">
          <MarqueeText
            className="led-text min-w-0 flex-1 text-[clamp(1.1rem,2.4vw,1.85rem)] font-semibold tracking-wide"
            style={{ textShadow: `0 0 ${glowPx}px rgba(255,176,0,${0.35 + glow * 0.45})` }}
          >
            {primaryText}
          </MarqueeText>
          {!isScheduled && arrival.isDelayed && (
            <span className="led-text shrink-0 text-xs uppercase tracking-[0.2em] text-orange-400/90">
              Delayed
            </span>
          )}
          {!isScheduled && arrival.isApproaching && !arrival.isDelayed && (
            <span className="led-text shrink-0 text-xs uppercase tracking-[0.2em] text-emerald-400/90 animate-pulse">
              Approaching
            </span>
          )}
        </div>
        {!isScheduled && arrival.locationLabel && (
          <MarqueeText
            className="led-text mt-0.5 min-w-0 text-[clamp(0.75rem,1.4vw,1rem)] text-amber-500/70"
            style={{ textShadow: `0 0 ${glowPx * 0.5}px rgba(255,176,0,0.25)` }}
          >
            {arrival.locationLabel}
          </MarqueeText>
        )}
      </div>

      <div className="shrink-0 text-right">
        <div
          className={`led-text tabular-nums font-bold tracking-wider ${
            !isScheduled && arrival.minutesAway <= 0
              ? "text-[clamp(1.4rem,3vw,2.2rem)] text-emerald-400"
              : "text-[clamp(1.35rem,2.8vw,2.1rem)]"
          } ${isScheduled ? "text-amber-400/90" : ""}`}
          style={{
            textShadow:
              !isScheduled && arrival.minutesAway <= 0
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
