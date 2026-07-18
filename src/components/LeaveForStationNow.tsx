"use client";

interface LeaveForStationNowProps {
  visible: boolean;
}

/** Bottom banner — only visible when the next inbound train is 3–7 minutes away. */
export function LeaveForStationNow({ visible }: LeaveForStationNowProps) {
  if (!visible) return null;

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
