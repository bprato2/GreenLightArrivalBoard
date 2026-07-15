"use client";

/** MBTA-style station name plate — bold condensed sans on black with Green Line bullet. */
export function StationHeader({ stationName }: { stationName: string }) {
  return (
    <div className="station-header flex items-center gap-2.5">
      <span
        className="green-line-bullet h-3 w-3 shrink-0 rounded-full bg-[#00843d]"
        aria-hidden
      />
      <h1 className="station-name font-[family-name:var(--font-station)] text-[clamp(1.1rem,2.6vw,1.9rem)] font-bold uppercase leading-none tracking-[0.06em] text-white">
        {stationName}
      </h1>
    </div>
  );
}
