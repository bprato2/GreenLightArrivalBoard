"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AmtrakPanel } from "@/components/AmtrakPanel";
import { AppChrome } from "@/components/AppChrome";
import {
  MapLineFilters,
  type MapLineScope,
} from "@/components/MapLineFilters";
import { useRouteVehicles } from "@/hooks/useRouteVehicles";
import { useSettings } from "@/hooks/useSettings";
import {
  GREEN_LINE_ALL_ID,
  ROUTE_ID,
} from "@/lib/mbta/boardConfig";
import {
  fetchNetworkRouteCatalog,
  fetchRoutesForMode,
  type NetworkRouteEntry,
} from "@/lib/mbta/catalog";
import {
  fetchModeOverviewPolylines,
  fetchPolylinesForRoutes,
  fetchRoutePolyline,
  fetchSubwayOverviewPolylines,
  highlightRouteIds,
  SUBWAY_OVERVIEW_ROUTES,
  type RoutePolyline,
} from "@/lib/mbta/shapes";
import type { StationInfo } from "@/lib/mbta/stations";
import type { TransitMode } from "@/lib/providers/types";
import { MBTA_LIVE_MODES } from "@/lib/providers/types";

const LiveMapCanvas = dynamic(
  () =>
    import("@/components/LiveMapCanvas").then((m) => m.LiveMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <span className="led-text tracking-[0.25em] text-amber-600/70">
          LOADING MAP…
        </span>
      </div>
    ),
  },
);

function modeForRouteId(routeId: string, fallback: TransitMode): TransitMode {
  if (SUBWAY_OVERVIEW_ROUTES.some((r) => r.id === routeId)) return "subway";
  if (routeId === GREEN_LINE_ALL_ID || routeId.startsWith("Green-")) {
    return "subway";
  }
  if (routeId.startsWith("CR-")) return "commuter_rail";
  if (routeId.startsWith("Boat-")) return "ferry";
  if (/^\d/.test(routeId) || routeId.startsWith("7")) return "bus";
  return fallback;
}

export function LiveMapView() {
  const router = useRouter();
  const { settings, setSettings, hydrated } = useSettings();
  const isAmtrak = settings.mode === "amtrak";

  const [scope, setScope] = useState<MapLineScope>("mode");
  const [catalog, setCatalog] = useState<NetworkRouteEntry[]>([]);
  const [modeLines, setModeLines] = useState<RoutePolyline[]>([]);
  const [extraLines, setExtraLines] = useState<RoutePolyline[]>([]);
  const [activeLine, setActiveLine] = useState<RoutePolyline | null>(null);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const filterEntries = useMemo(() => {
    const base =
      scope === "all"
        ? catalog.filter((e) => e.routeId !== GREEN_LINE_ALL_ID)
        : catalog.filter(
            (e) =>
              e.mode === settings.mode && e.routeId !== GREEN_LINE_ALL_ID,
          );
    // Subway mode list: curated rapid-transit order when available.
    if (scope === "mode" && settings.mode === "subway") {
      const order = SUBWAY_OVERVIEW_ROUTES.map((r) => r.id);
      return [...base].sort((a, b) => {
        const ai = order.indexOf(a.routeId);
        const bi = order.indexOf(b.routeId);
        if (ai >= 0 || bi >= 0) {
          if (ai < 0) return 1;
          if (bi < 0) return -1;
          return ai - bi;
        }
        return a.routeLabel.localeCompare(b.routeLabel);
      });
    }
    return base;
  }, [catalog, scope, settings.mode]);

  const visibleRouteIds = useMemo(
    () => filterEntries.map((e) => e.routeId).filter((id) => visibleIds.has(id)),
    [filterEntries, visibleIds],
  );

  // Cap live vehicle subscription size (URL / browser limits on huge bus sets).
  const vehicleRouteIds = useMemo(() => {
    if (visibleRouteIds.length <= 40) return visibleRouteIds;
    const preferred = settings.routeId ? [settings.routeId] : [];
    const rest = visibleRouteIds
      .filter((id) => id !== settings.routeId)
      .slice(0, 40 - preferred.length);
    return [...preferred, ...rest];
  }, [visibleRouteIds, settings.routeId]);

  const { vehicles, connected, error: streamError } = useRouteVehicles(
    vehicleRouteIds,
    !isAmtrak && vehicleRouteIds.length > 0,
  );

  const setMode = (mode: TransitMode) => {
    setScope("mode");
    if (mode === "subway") {
      setSettings({
        ...settings,
        mode,
        routeId: ROUTE_ID,
        routeColor: "#00843d",
      });
      return;
    }
    setSettings({ ...settings, mode, routeId: "", stopId: "", stopName: "" });
  };

  // Network catalog for checkboxes (all modes).
  useEffect(() => {
    if (isAmtrak) return;
    let cancelled = false;
    void fetchNetworkRouteCatalog()
      .then((list) => {
        if (!cancelled) setCatalog(list);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAmtrak]);

  // Auto-pick first route when mode has none.
  useEffect(() => {
    if (isAmtrak || settings.routeId || !settings.mode) return;
    let cancelled = false;
    void fetchRoutesForMode(settings.mode).then((list) => {
      if (cancelled || !list[0]) return;
      setSettings({
        ...settings,
        routeId: list[0].id,
        routeColor: list[0].color,
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.mode, settings.routeId, isAmtrak]);

  // Reset visible checks when mode or scope changes (not when activating a line).
  useEffect(() => {
    if (isAmtrak) return;
    if (scope === "all") {
      const subway = new Set(SUBWAY_OVERVIEW_ROUTES.map((r) => r.id));
      if (settings.routeId) subway.add(settings.routeId);
      setVisibleIds(subway);
      return;
    }
    if (filterEntries.length === 0) return;
    setVisibleIds(new Set(filterEntries.map((e) => e.routeId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on mode/scope/catalog size only
  }, [settings.mode, scope, isAmtrak, filterEntries.length]);

  // Load geometry for current mode (all lines).
  useEffect(() => {
    if (isAmtrak) {
      setModeLines([]);
      return;
    }
    if (scope === "all") {
      // Load subway base + any other modes that have visible checks.
      let cancelled = false;
      setLoading(true);
      void (async () => {
        try {
          const subway = await fetchSubwayOverviewPolylines();
          const modes = new Set<TransitMode>();
          for (const id of visibleIds) {
            const entry = catalog.find((e) => e.routeId === id);
            if (entry && entry.mode !== "subway") modes.add(entry.mode);
          }
          const extras: RoutePolyline[] = [];
          for (const m of modes) {
            if (!MBTA_LIVE_MODES.includes(m) || m === "subway") continue;
            const lines = await fetchModeOverviewPolylines(
              m as "commuter_rail" | "bus" | "ferry",
            );
            extras.push(...lines);
          }
          if (!cancelled) {
            setModeLines([...subway, ...extras]);
            setLoadError(null);
          }
        } catch {
          if (!cancelled) setLoadError("Could not load route maps");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (!MBTA_LIVE_MODES.includes(settings.mode)) {
      setModeLines([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchModeOverviewPolylines(
      settings.mode as "subway" | "commuter_rail" | "bus" | "ferry",
    )
      .then((lines) => {
        if (!cancelled) {
          setModeLines(lines);
          setLoadError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModeLines([]);
          setLoadError("Could not load route maps");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // visibleIds intentionally omitted for mode scope — full mode set is cached.
    // For all scope we reload when visibleIds gains new modes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.mode, isAmtrak, scope, catalog]);

  // When all-scope adds bus/CR/ferry checks, ensure those polylines exist.
  useEffect(() => {
    if (isAmtrak || scope !== "all") {
      setExtraLines([]);
      return;
    }
    const missing = [...visibleIds].filter(
      (id) => !modeLines.some((l) => l.routeId === id),
    );
    if (missing.length === 0) {
      setExtraLines([]);
      return;
    }
    let cancelled = false;
    const routes = missing
      .map((id) => {
        const entry = catalog.find((e) => e.routeId === id);
        return entry
          ? { id: entry.routeId, color: entry.routeColor }
          : null;
      })
      .filter(Boolean) as { id: string; color: string }[];

    void fetchPolylinesForRoutes(routes).then((lines) => {
      if (!cancelled) setExtraLines(lines);
    });
    return () => {
      cancelled = true;
    };
  }, [visibleIds, modeLines, catalog, scope, isAmtrak]);

  // Active route stations / highlight geometry.
  useEffect(() => {
    if (isAmtrak || !settings.routeId) {
      setActiveLine(null);
      return;
    }
    let cancelled = false;
    void fetchRoutePolyline(
      settings.routeId,
      settings.routeColor || "#888888",
      settings.stopId,
    ).then((line) => {
      if (!cancelled) setActiveLine(line);
    });
    return () => {
      cancelled = true;
    };
  }, [settings.routeId, settings.routeColor, settings.stopId, isAmtrak]);

  const highlightIds = useMemo(
    () => highlightRouteIds(settings.routeId),
    [settings.routeId],
  );

  const lines = useMemo(() => {
    const byId = new Map<string, RoutePolyline>();
    for (const line of modeLines) byId.set(line.routeId, line);
    for (const line of extraLines) byId.set(line.routeId, line);
    if (
      activeLine &&
      activeLine.routeId !== GREEN_LINE_ALL_ID &&
      !byId.has(activeLine.routeId)
    ) {
      byId.set(activeLine.routeId, activeLine);
    }
    return [...byId.values()].filter((l) => visibleIds.has(l.routeId));
  }, [modeLines, extraLines, activeLine, visibleIds]);

  const stations = activeLine?.stations ?? [];

  const routeColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of catalog) map[e.routeId] = e.routeColor;
    for (const l of lines) map[l.routeId] = l.color;
    return map;
  }, [catalog, lines]);

  const activateEntry = (entry: NetworkRouteEntry) => {
    setVisibleIds((prev) => new Set(prev).add(entry.routeId));
    setSettings({
      ...settings,
      mode: entry.mode,
      routeId: entry.routeId,
      routeColor: entry.routeColor,
      stopId: "",
      stopName: "",
      stopLat: 0,
      stopLon: 0,
    });
  };

  const onSelectRouteFromMap = (routeId: string, color: string) => {
    setVisibleIds((prev) => new Set(prev).add(routeId));
    if (routeId === settings.routeId) return;
    const entry = catalog.find((e) => e.routeId === routeId);
    setSettings({
      ...settings,
      mode: entry?.mode ?? modeForRouteId(routeId, settings.mode),
      routeId,
      routeColor: color,
      stopId: "",
      stopName: "",
      stopLat: 0,
      stopLon: 0,
    });
  };

  const onSelectStation = (station: StationInfo) => {
    setSettings({
      ...settings,
      stopId: station.id,
      stopName: station.name,
      stopLat: station.lat,
      stopLon: station.lon,
      appView: "board",
    });
    router.push("/");
  };

  const onToggle = (routeId: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      return next;
    });
  };

  const onSelectAll = () => {
    setVisibleIds(new Set(filterEntries.map((e) => e.routeId)));
  };

  const onClearAll = () => {
    setVisibleIds(
      settings.routeId ? new Set([settings.routeId]) : new Set(),
    );
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black text-amber-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-black text-amber-400">
      <AppChrome
        mode={settings.mode}
        appView="map"
        onModeChange={setMode}
        onViewChange={(view) => {
          if (view === "board") router.push("/");
          if (view === "plan") router.push("/plan");
        }}
      />

      {isAmtrak ? (
        <div className="min-h-0 flex-1 overflow-y-auto" data-allow-scroll="true">
          <AmtrakPanel />
        </div>
      ) : (
        <>
          <div className="flex shrink-0 flex-col gap-2 border-b border-amber-900/30 px-3 py-2 sm:flex-row">
            <div className="min-w-0 flex-1">
              <MapLineFilters
                entries={filterEntries}
                visibleIds={visibleIds}
                activeRouteId={settings.routeId}
                scope={scope}
                mode={settings.mode}
                onScopeChange={setScope}
                onToggle={onToggle}
                onSelectAll={onSelectAll}
                onClearAll={onClearAll}
                onActivate={activateEntry}
              />
            </div>
            <div className="flex shrink-0 flex-col justify-end gap-1 pb-1 sm:items-end">
              <div className="led-text text-[0.55rem] uppercase tracking-[0.18em] text-amber-700/70">
                {connected ? (
                  <span className="text-emerald-500/80">
                    Live · {vehicles.length} vehicles
                  </span>
                ) : (
                  <span>{streamError ?? "Connecting…"}</span>
                )}
              </div>
              <p className="max-w-[16rem] text-[0.6rem] leading-snug text-amber-700/55 sm:text-right">
                Check lines to show · tap a name for active stations · tap map
                line to switch · trains show IN/OUT + heading
              </p>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 px-2 pb-2 pt-1">
            {loading && lines.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <span className="led-text tracking-[0.25em] text-amber-600/70">
                  LOADING MAP…
                </span>
              </div>
            ) : loadError && lines.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <span className="led-text text-amber-600/80">{loadError}</span>
              </div>
            ) : (
              <LiveMapCanvas
                lines={lines}
                highlightIds={highlightIds}
                vehicles={vehicles}
                vehicleColor={settings.routeColor || "#f59e0b"}
                routeColors={routeColors}
                stations={stations}
                selectedStopId={settings.stopId}
                onSelectStation={onSelectStation}
                onSelectRoute={onSelectRouteFromMap}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
