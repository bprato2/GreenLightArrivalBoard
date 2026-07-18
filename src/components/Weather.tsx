"use client";

import { weatherIcon } from "@/lib/weather";
import type { WeatherSnapshot } from "@/lib/weather";

interface WeatherProps {
  data: WeatherSnapshot | null;
  error: string | null;
  glow: number;
}

/** Top-right weather: temperature + short condition label. */
export function Weather({ data, error, glow }: WeatherProps) {
  const glowPx = 3 + glow * 10;
  const meta = data ? weatherIcon(data.weatherCode, data.isDay) : null;
  const shadow = {
    textShadow: `0 0 ${glowPx}px rgba(255,176,0,${0.3 + glow * 0.4})`,
  };

  return (
    <div
      className="weather-widget flex min-w-[4.5rem] flex-col items-end justify-center gap-0.5"
      aria-label={
        data && meta
          ? `Current weather: ${data.temperatureF} degrees, ${meta.label}`
          : "Current weather"
      }
    >
      {data && meta ? (
        <>
          <span
            className="led-text text-[clamp(1.2rem,2.5vw,1.75rem)] tabular-nums leading-none"
            style={shadow}
          >
            {data.temperatureF}°
          </span>
          <span className="led-text text-[0.55rem] uppercase tracking-[0.18em] text-amber-600/85">
            {meta.label}
          </span>
        </>
      ) : (
        <span className="led-text text-sm text-amber-700/70">{error ?? "…"}</span>
      )}
    </div>
  );
}
