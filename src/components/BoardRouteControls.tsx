"use client";

import { useEffect, useState } from "react";
import {
  DIRECTIONS,
  GREEN_LINE_ALL_ID,
  coerceDirection,
  type DirectionId,
} from "@/lib/mbta/boardConfig";
import { fetchRoutesForMode, fetchStopsForRoute } from "@/lib/mbta/catalog";
import type { TransitMode, TransitRoute, TransitStop } from "@/lib/providers/types";
import type { BoardSettings } from "@/types/settings";

interface BoardRouteControlsProps {
  settings: BoardSettings;
  onChange: (patch: Partial<BoardSettings>) => void;
  compact?: boolean;
  /** Hide mode selector when parent already shows mode tabs. */
  hideMode?: boolean;
  /** Hide direction when parent places it elsewhere (e.g. above walk time). */
  hideDirection?: boolean;
}

const selectClass =
  "rounded border border-amber-900/50 bg-black px-2 py-1.5 text-amber-200 outline-none focus:border-amber-500";

const MODES: { id: TransitMode; label: string }[] = [
  { id: "subway", label: "Subway" },
  { id: "commuter_rail", label: "Commuter Rail" },
  { id: "bus", label: "Bus" },
  { id: "amtrak", label: "Amtrak" },
];

export function DirectionSelect({
  settings,
  onChange,
  compact = false,
}: {
  settings: BoardSettings;
  onChange: (patch: Partial<BoardSettings>) => void;
  compact?: boolean;
}) {
  const labelClass = compact
    ? "led-text text-[0.55rem] uppercase tracking-[0.2em] text-amber-700/80"
    : "text-zinc-400 text-sm";
  const fieldSelect = compact
    ? `${selectClass} text-[0.65rem] uppercase tracking-wide w-full min-w-[7rem]`
    : selectClass;

  return (
    <label className="flex flex-col gap-0.5">
      <span className={labelClass}>Direction</span>
      <select
        className={fieldSelect}
        value={coerceDirection(settings.directionId)}
        onChange={(e) =>
          onChange({ directionId: Number(e.target.value) as DirectionId })
        }
      >
        {DIRECTIONS.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Mode → route → departure station → direction controls. */
export function BoardRouteControls({
  settings,
  onChange,
  compact = false,
  hideMode = false,
  hideDirection = false,
}: BoardRouteControlsProps) {
  const [routes, setRoutes] = useState<TransitRoute[]>([]);
  const [stops, setStops] = useState<TransitStop[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingStops, setLoadingStops] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.mode === "amtrak") {
      setRoutes([]);
      setStops([]);
      return;
    }
    let cancelled = false;
    setLoadingRoutes(true);
    setError(null);
    void fetchRoutesForMode(settings.mode)
      .then((list) => {
        if (cancelled) return;
        setRoutes(list);
        const stillValid = list.some((r) => r.id === settings.routeId);
        if (!stillValid && list[0]) {
          onChange({
            routeId: list[0].id,
            routeColor: list[0].color,
            stopId: "",
            stopName: "",
          });
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load routes");
      })
      .finally(() => {
        if (!cancelled) setLoadingRoutes(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mode change
  }, [settings.mode]);

  useEffect(() => {
    if (settings.mode === "amtrak" || !settings.routeId) {
      setStops([]);
      return;
    }
    let cancelled = false;
    setLoadingStops(true);
    setError(null);
    void fetchStopsForRoute(settings.routeId)
      .then((list) => {
        if (cancelled) return;
        setStops(list);
        const stillValid = list.some((s) => s.id === settings.stopId);
        if (!stillValid && list[0]) {
          onChange({
            stopId: list[0].id,
            stopName: list[0].name,
            stopLat: list[0].lat,
            stopLon: list[0].lon,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStops([]);
          setError("Could not load stops");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStops(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on route change
  }, [settings.routeId, settings.mode]);

  const setMode = (mode: TransitMode) => {
    if (mode === "subway") {
      onChange({
        mode,
        routeId: "Green-D",
        stopId: "place-newtn",
        stopName: "Newton Highlands",
        stopLat: 42.3222,
        stopLon: -71.2054,
        routeColor: "#00843d",
      });
      return;
    }
    onChange({ mode, routeId: "", stopId: "", stopName: "" });
  };

  const setRoute = (routeId: string) => {
    const route = routes.find((r) => r.id === routeId);
    onChange({
      routeId,
      routeColor: route?.color ?? settings.routeColor,
      stopId: "",
    });
  };

  const setStation = (stopId: string) => {
    const stop = stops.find((s) => s.id === stopId);
    onChange({
      stopId,
      stopName: stop?.name ?? stopId,
      stopLat: stop?.lat ?? 0,
      stopLon: stop?.lon ?? 0,
    });
  };

  const labelClass = compact
    ? "led-text text-[0.55rem] uppercase tracking-[0.2em] text-amber-700/80"
    : "text-zinc-400 text-sm";
  const fieldSelect = compact
    ? `${selectClass} text-[0.65rem] uppercase tracking-wide min-w-[7rem] max-w-[14rem]`
    : selectClass;

  const fields = (
    <>
      {!hideMode && (
        <label className="flex flex-col gap-0.5">
          <span className={labelClass}>Mode</span>
          <select
            className={fieldSelect}
            value={settings.mode}
            onChange={(e) => setMode(e.target.value as TransitMode)}
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {settings.mode !== "amtrak" && (
        <>
          <label className="flex flex-col gap-0.5">
            <span className={labelClass}>Route</span>
            <select
              className={fieldSelect}
              value={settings.routeId}
              disabled={loadingRoutes || routes.length === 0}
              onChange={(e) => setRoute(e.target.value)}
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id === GREEN_LINE_ALL_ID
                    ? "Green Line (all)"
                    : r.shortName
                      ? `${r.shortName} · ${r.label}`
                      : r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-0.5">
            <span className={labelClass}>Departure Station</span>
            <select
              className={fieldSelect}
              value={
                stops.some((s) => s.id === settings.stopId) ? settings.stopId : ""
              }
              disabled={loadingStops || stops.length === 0}
              onChange={(e) => setStation(e.target.value)}
            >
              {loadingStops && (
                <option value="">Loading…</option>
              )}
              {!loadingStops && stops.length === 0 && (
                <option value="">No stations</option>
              )}
              {stops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          {!hideDirection && (
            <DirectionSelect
              settings={settings}
              onChange={onChange}
              compact={compact}
            />
          )}
        </>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-2">
        {fields}
        {error && (
          <span className="led-text text-[0.55rem] text-amber-600">{error}</span>
        )}
      </div>
    );
  }

  return (
    <fieldset className="rounded-lg border border-zinc-800 p-4">
      <legend className="px-1 text-sm text-amber-500">Route</legend>
      <div className="mt-2 flex flex-col gap-3">{fields}</div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <p className="mt-2 text-xs text-zinc-500">
        Live predictions follow the selected mode, route, departure station, and
        direction. Choose Green Line (all) to see every Green branch at a shared
        stop.
      </p>
    </fieldset>
  );
}
