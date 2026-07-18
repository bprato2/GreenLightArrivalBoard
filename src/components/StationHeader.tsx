"use client";

import { GREEN_LINE_COLOR } from "@/lib/mbta/boardConfig";

/** MBTA-style station name plate — bold condensed sans on black with route bullet. */
export function StationHeader({
  stationName,
  accentColor = GREEN_LINE_COLOR,
}: {
  stationName: string;
  accentColor?: string;
}) {
  return (
    <div className="station-header flex items-center gap-2.5">
      <span
        className="route-bullet h-3 w-3 shrink-0 rounded-full"
        style={{
          backgroundColor: accentColor,
          boxShadow: `0 0 8px ${accentColor}99`,
        }}
        aria-hidden
      />
      <h1 className="station-name font-[family-name:var(--font-station)] text-[clamp(1.1rem,2.6vw,1.9rem)] font-bold uppercase leading-none tracking-[0.06em] text-white">
        {stationName}
      </h1>
    </div>
  );
}
