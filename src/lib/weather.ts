/** Open-Meteo (no API key) current conditions near the selected station. */

import { resolveStation, TARGET_STOP_ID } from "@/lib/mbta/stations";

export interface WeatherSnapshot {
  temperatureF: number;
  weatherCode: number;
  isDay: boolean;
  fetchedAt: number;
}

/** WMO weather interpretation codes → LED-board friendly glyph + label. */
export function weatherIcon(code: number, isDay: boolean): { icon: string; label: string } {
  if (code === 0) return { icon: isDay ? "*" : "o", label: "Clear" };
  if (code <= 3) return { icon: "=", label: "Cloudy" };
  if (code <= 48) return { icon: "~", label: "Fog" };
  if (code <= 57) return { icon: "/", label: "Drizzle" };
  if (code <= 67) return { icon: "/", label: "Rain" };
  if (code <= 77) return { icon: "*", label: "Snow" };
  if (code <= 82) return { icon: "/", label: "Showers" };
  if (code <= 86) return { icon: "*", label: "Snow" };
  if (code <= 99) return { icon: "!", label: "Storm" };
  return { icon: "-", label: "—" };
}

const FALLBACK = { lat: 42.3226, lon: -71.2055 };

export async function fetchWeather(stationId = TARGET_STOP_ID): Promise<WeatherSnapshot> {
  const station = resolveStation(stationId);
  const lat = station?.lat ?? FALLBACK.lat;
  const lon = station?.lon ?? FALLBACK.lon;

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}` +
    `&longitude=${lon}` +
    `&current=temperature_2m,weather_code,is_day` +
    `&temperature_unit=fahrenheit` +
    `&timezone=America%2FNew_York`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Weather HTTP ${res.status}`);
  const data = (await res.json()) as {
    current: {
      temperature_2m: number;
      weather_code: number;
      is_day: number;
    };
  };

  return {
    temperatureF: Math.round(data.current.temperature_2m),
    weatherCode: data.current.weather_code,
    isDay: data.current.is_day === 1,
    fetchedAt: Date.now(),
  };
}
