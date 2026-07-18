"use client";

import type { LeaveAdvice } from "@/lib/walk";

interface LeaveForStationNowProps {
  advice: LeaveAdvice;
}

/**
 * Bottom banner:
 * - leave: next catchable train is within walk time (+ early buffer)
 * - missed: soonest train is already too close given walk time
 */
export function LeaveForStationNow({ advice }: LeaveForStationNowProps) {
  if (advice.kind === "idle") return null;

  if (advice.kind === "missed") {
    const short =
      advice.shortfallMinutes === 1
        ? "1 min short"
        : `${advice.shortfallMinutes} min short`;
    return (
      <section
        className="leave-miss-banner relative z-30 flex shrink-0 items-center justify-center gap-3 border-t border-amber-700/50 bg-amber-950/90 px-5 py-2.5"
        aria-live="polite"
        aria-label="Won't make this train"
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]"
          aria-hidden
        />
        <span className="led-text text-center text-[clamp(0.75rem,1.8vw,1.05rem)] font-bold uppercase tracking-[0.22em] text-amber-300">
          Won&apos;t make this train
          <span className="mt-0.5 block text-[0.65em] font-semibold tracking-[0.18em] text-amber-500/90">
            {short} · waiting for next
          </span>
        </span>
      </section>
    );
  }

  return (
    <section
      className="leave-now-banner relative z-30 flex shrink-0 items-center justify-center gap-3 border-t border-emerald-700/50 bg-emerald-950/90 px-5 py-2.5 animate-leave-now-blink"
      aria-live="polite"
      aria-label="Leave for station now"
    >
      <span
        className="h-3 w-3 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
        aria-hidden
      />
      <span className="led-text text-[clamp(0.85rem,2vw,1.15rem)] font-bold uppercase tracking-[0.28em] text-emerald-300">
        Leave for Station Now
      </span>
    </section>
  );
}
