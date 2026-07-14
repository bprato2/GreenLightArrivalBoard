"use client";

import { weatherIcon } from "@/lib/weather";
import type { WeatherSnapshot } from "@/lib/weather";

interface WeatherProps {
  data: WeatherSnapshot | null;
  error: string | null;
  glow: number;
}

export function Weather({ data, error, glow }: WeatherProps) {
  const glowPx = 3 + glow * 10;
  const meta = data ? weatherIcon(data.weatherCode, data.isDay) : null;

  return (
    <div
      className="weather-widget led-text text-right leading-tight"
      style={{ textShadow: `0 0 ${glowPx}px rgba(255,176,0,${0.3 + glow * 0.4})` }}
      aria-label="Current weather"
    >
      {data && meta ? (
        <>
          <div className="text-[clamp(1.1rem,2.2vw,1.6rem)] tabular-nums">
            <span className="mr-2 opacity-90" aria-hidden>
              {meta.icon}
            </span>
            {data.temperatureF}°F
          </div>
          <div className="text-[0.7rem] uppercase tracking-[0.18em] text-amber-500/65">
            {meta.label}
          </div>
        </>
      ) : (
        <div className="text-sm text-amber-700/70">{error ?? "…"}</div>
      )}
    </div>
  );
}
