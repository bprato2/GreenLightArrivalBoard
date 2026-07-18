"use client";

import { useEffect, useState } from "react";
import {
  DepartureStationSelect,
  type DepartureStationSelection,
} from "@/components/DepartureStationSelect";
import { RouteSelect, type RouteSelection } from "@/components/RouteSelect";
import {
  coerceDirection,
  directionsForRoute,
  type DirectionId,
} from "@/lib/mbta/boardConfig";
import {
  fetchRoutesForMode,
  fetchStopsForRoute,
  fetchNetworkStopCatalog,
  fetchNetworkRouteCatalog,
  fetchRouteById,
} from "@/lib/mbta/catalog";
import type { TransitMode, TransitRoute, TransitStop } from "@/lib/providers/types";
import { TRANSIT_MODES } from "@/lib/providers/types";
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

export function DirectionSelect({
  settings,
  onChange,
  compact = false,
}: {
  settings: BoardSettings;
  onChange: (patch: Partial<BoardSettings>) => void;
  compact?: boolean;
}) {
  const [options, setOptions] = useState(() =>
    directionsForRoute(null),
  );

  useEffect(() => {
    if (!settings.routeId || settings.mode === "amtrak") {
      setOptions(directionsForRoute(null));
      return;
    }
    let cancelled = false;
    void fetchRouteById(settings.routeId).then((route) => {
      if (!cancelled) setOptions(directionsForRoute(route));
    });
    return () => {
      cancelled = true;
    };
  }, [settings.routeId, settings.mode]);

  const labelClass = compact
    ? "led-text text-[0.55rem] uppercase tracking-[0.2em] text-amber-700/80"
    : "text-zinc-400 text-sm";
  const fieldSelect = compact
    ? `${selectClass} text-[0.65rem] uppercase tracking-wide w-full min-w-[7rem] max-w-[16rem]`
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
        {options.map((d) => (
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

  // Warm network catalogs in the background.
  useEffect(() => {
    void fetchNetworkStopCatalog().catch(() => {});
    void fetchNetworkRouteCatalog().catch(() => {});
  }, []);

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
        // Only auto-pick a stop when none is set (avoid clobbering network jumps).
        const stillValid = list.some((s) => s.id === settings.stopId);
        if (!stillValid && !settings.stopId && list[0]) {
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

  const setRouteSelection = (selection: RouteSelection) => {
    if (selection.keepStop && settings.stopId) {
      onChange({
        mode: selection.mode,
        routeId: selection.routeId,
        routeColor: selection.routeColor,
      });
      return;
    }
    onChange({
      mode: selection.mode,
      routeId: selection.routeId,
      routeColor: selection.routeColor,
      stopId: "",
      stopName: "",
      stopLat: 0,
      stopLon: 0,
    });
  };

  const setStationSelection = (selection: DepartureStationSelection) => {
    if (selection.mode && selection.routeId) {
      onChange({
        mode: selection.mode,
        routeId: selection.routeId,
        routeColor: selection.routeColor ?? settings.routeColor,
        stopId: selection.stopId,
        stopName: selection.stopName,
        stopLat: selection.stopLat,
        stopLon: selection.stopLon,
      });
      return;
    }
    onChange({
      stopId: selection.stopId,
      stopName: selection.stopName,
      stopLat: selection.stopLat,
      stopLon: selection.stopLon,
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
            {TRANSIT_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {settings.mode !== "amtrak" && (
        <>
          <div className="flex flex-col gap-0.5">
            <span className={labelClass}>Route</span>
            <RouteSelect
              mode={settings.mode}
              routeId={settings.routeId}
              stopId={settings.stopId}
              stopName={settings.stopName}
              compact={compact}
              disabled={loadingRoutes && routes.length === 0}
              onSelect={setRouteSelection}
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className={labelClass}>Departure Station</span>
            <DepartureStationSelect
              routeId={settings.routeId}
              stopId={settings.stopId}
              stopName={settings.stopName}
              routeStops={stops}
              loadingRouteStops={loadingStops}
              compact={compact}
              onSelect={setStationSelection}
            />
          </div>

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
        With a departure station selected, routes that stop there appear first.
        Below that are other routes in the current mode (subway / CR / bus / ferry). Use
        search to find routes in other modes.
      </p>
    </fieldset>
  );
}
