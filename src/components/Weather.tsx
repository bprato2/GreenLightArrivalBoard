"use client";

import { weatherIcon } from "@/lib/weather";
import type { WeatherSnapshot } from "@/lib/weather";

interface WeatherProps {
  data: WeatherSnapshot | null;
  error: string | null;
  glow: number;
}

/** Compact weather corner — icon only, no temperature or condition text. */
export function Weather({ data, error, glow }: WeatherProps) {
  const glowPx = 3 + glow * 10;
  const meta = data ? weatherIcon(data.weatherCode, data.isDay) : null;

  return (
    <div
      className="weather-widget flex items-center justify-end"
      aria-label={meta ? `Current weather: ${meta.label}` : "Current weather"}
    >
      {data && meta ? (
        <span
          className="led-text text-[clamp(1.4rem,2.8vw,2rem)] leading-none opacity-90"
          style={{ textShadow: `0 0 ${glowPx}px rgba(255,176,0,${0.3 + glow * 0.4})` }}
          aria-hidden
        >
          {meta.icon}
        </span>
      ) : (
        <span className="led-text text-sm text-amber-700/70">{error ?? "…"}</span>
      )}
    </div>
  );
}
