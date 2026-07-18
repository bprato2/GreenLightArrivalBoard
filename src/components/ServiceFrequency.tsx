"use client";

import { deriveServiceFrequency } from "@/lib/mbta/frequency";
import type { Arrival, ScheduleResource } from "@/lib/mbta/types";

interface ServiceFrequencyProps {
  schedules: ScheduleResource[];
  arrivals: Arrival[];
  nowMs: number;
  glow: number;
}

/** Displays headway above the leave-now banner (schedules, with live fallback). */
export function ServiceFrequency({
  schedules,
  arrivals,
  nowMs,
  glow,
}: ServiceFrequencyProps) {
  const { message, hasService } = deriveServiceFrequency(schedules, arrivals, nowMs);

  return (
    <section
      className="service-frequency relative z-30 flex shrink-0 items-center justify-center border-t border-emerald-900/40 bg-black/60 px-5 py-2"
      aria-label="Train service frequency"
    >
      <span
        className={`led-text text-[clamp(0.75rem,1.6vw,0.95rem)] font-bold uppercase tracking-[0.28em] ${
          hasService ? "text-emerald-400/90" : "text-emerald-700/70"
        }`}
        style={{
          textShadow: hasService
            ? `0 0 ${4 + glow * 8}px rgba(52,211,153,${0.35 + glow * 0.35})`
            : undefined,
        }}
      >
        {message}
      </span>
    </section>
  );
}
