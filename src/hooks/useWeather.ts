"use client";

import { useEffect, useState } from "react";
import { fetchWeather, type WeatherSnapshot } from "@/lib/weather";

const REFRESH_MS = 10 * 60 * 1000;

export function useWeather(enabled: boolean) {
  const [data, setData] = useState<WeatherSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const load = async () => {
      try {
        const snap = await fetchWeather();
        if (!cancelled) {
          setData(snap);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Weather unavailable");
      }
    };

    void load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return { data, error };
}
