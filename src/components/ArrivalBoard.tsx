"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AmtrakPanel } from "@/components/AmtrakPanel";
import { AnnouncementManager } from "@/components/AnnouncementManager";
import { AppChrome } from "@/components/AppChrome";
import { ArrivalRow } from "@/components/ArrivalRow";
import { BoardRouteControls, DirectionSelect } from "@/components/BoardRouteControls";
import { LeaveForStationNow } from "@/components/LeaveForStationNow";
import { MiniMap } from "@/components/MiniMap";
import { ServiceFrequency } from "@/components/ServiceFrequency";
import { StationHeader } from "@/components/StationHeader";
import { WalkToStation } from "@/components/WalkToStation";
import { Weather } from "@/components/Weather";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useArrivalAlert } from "@/hooks/useArrivalAlert";
import { useClock } from "@/hooks/useClock";
import { useMbtaSchedules } from "@/hooks/useMbtaSchedules";
import { useMbtaStream } from "@/hooks/useMbtaStream";
import { useRouteCorridor } from "@/hooks/useRouteCorridor";
import { useSettings } from "@/hooks/useSettings";
import { useWalkToStation } from "@/hooks/useWalkToStation";
import { useWeather } from "@/hooks/useWeather";
import {
  GREEN_LINE_ALL_ID,
  ROUTE_ID,
  getDirectionOption,
} from "@/lib/mbta/boardConfig";
import { fetchRouteById } from "@/lib/mbta/catalog";
import { stationDisplayName } from "@/lib/mbta/stations";
import { getLeaveAdvice } from "@/lib/walk";
import type { Arrival } from "@/lib/mbta/types";
import type { TransitMode, TransitRoute } from "@/lib/providers/types";

function mergeBoardRows(live: Arrival[], scheduled: Arrival[]): Arrival[] {
  return [...live, ...scheduled];
}

export function ArrivalBoard() {
  const router = useRouter();
  const { settings, setSettings, hydrated } = useSettings();
  const isAmtrak = settings.mode === "amtrak";
  const mapEnabled =
    settings.miniMapEnabled &&
    !isAmtrak &&
    Boolean(settings.routeId && settings.stopId);
  const { corridor, line } = useRouteCorridor(
    settings.routeId,
    settings.stopId,
    settings.directionId,
    mapEnabled,
  );
  const showMiniMap = mapEnabled && Boolean(corridor && corridor.stations.length > 0);
  const filter = {
    stopId: settings.stopId,
    directionId: settings.directionId,
    routeId: settings.routeId,
  };
  const [routeMeta, setRouteMeta] = useState<TransitRoute | null>(null);
  useEffect(() => {
    if (!settings.routeId || isAmtrak) {
      setRouteMeta(null);
      return;
    }
    let cancelled = false;
    void fetchRouteById(settings.routeId).then((route) => {
      if (!cancelled) setRouteMeta(route);
    });
    return () => {
      cancelled = true;
    };
  }, [settings.routeId, isAmtrak]);
  const directionDestinations = routeMeta?.directionDestinations ?? null;
  const { arrivals, trains, connected, error, nowMs } = useMbtaStream(filter, {
    routeColor: settings.routeColor,
    enabled: !isAmtrak && Boolean(settings.routeId && settings.stopId),
    corridor,
    line,
    directionDestinations,
  });
  const { scheduled, schedules } = useMbtaSchedules(
    arrivals,
    nowMs,
    settings.stopId,
    settings.directionId,
    settings.routeId,
    settings.routeColor,
    !isAmtrak && Boolean(settings.routeId && settings.stopId),
    directionDestinations,
  );
  const boardRows = mergeBoardRows(arrivals, scheduled);
  const { timeLine } = useClock();
  const weather = useWeather(settings.weatherEnabled && !isAmtrak, settings.stopId);
  const walk = useWalkToStation(settings.stopId, {
    auto: !isAmtrak && Boolean(settings.stopId),
    coords:
      settings.stopLat || settings.stopLon
        ? { lat: settings.stopLat, lon: settings.stopLon }
        : null,
  });
  const leaveAdvice = getLeaveAdvice(
    arrivals.map((a) => a.minutesAway),
    walk.estimate?.minutes ?? null,
  );
  const directionOpt = getDirectionOption(settings.directionId, routeMeta);
  const stationName =
    settings.stopName ||
    stationDisplayName(settings.stopId) ||
    settings.stopId;
  const closestMinutes = arrivals[0]?.minutesAway ?? null;
  const routeLabel =
    settings.routeId === GREEN_LINE_ALL_ID
      ? "Green Line"
      : settings.routeId.startsWith("Green-")
        ? `Green Line ${settings.routeId.replace("Green-", "")}`
        : settings.routeId || "Line";

useAnnouncements(arrivals, settings.announcementsEnabled && !isAmtrak);
useArrivalAlert(closestMinutes, settings);

  const glow = settings.ledGlowIntensity;

  const setMode = (mode: TransitMode) => {
    if (mode === "subway") {
      setSettings({
        ...settings,
        mode,
        routeId: ROUTE_ID,
        stopId: "place-newtn",
        stopName: "Newton Highlands",
        stopLat: 42.3222,
        stopLon: -71.2054,
        routeColor: "#00843d",
      });
      return;
    }
    setSettings({
      ...settings,
      mode,
      routeId: "",
      stopId: "",
      stopName: "",
    });
  };

  if (!hydrated) {
    return (
      <div className="board-shell flex h-[100dvh] w-screen items-center justify-center bg-black text-amber-500/80">
        <span className="led-text tracking-[0.3em]">INITIALIZING…</span>
      </div>
    );
  }

  return (
    <div
      className="board-shell relative flex h-[100dvh] max-h-[100dvh] w-screen max-w-[100vw] flex-col overflow-hidden bg-black text-amber-400"
      style={
        {
          "--led-glow": String(glow),
        } as CSSProperties
      }
    >
      <div className="led-scanlines pointer-events-none absolute inset-0 z-20" aria-hidden />
      <div className="led-vignette pointer-events-none absolute inset-0 z-10" aria-hidden />

      <AppChrome
        mode={settings.mode}
        appView="board"
        onModeChange={setMode}
        onViewChange={(view) => {
          if (view === "plan") router.push("/plan");
          if (view === "map") router.push("/map");
        }}
      />

      {isAmtrak ? (
        <div className="relative z-30 min-h-0 flex-1 overflow-y-auto" data-allow-scroll="true">
          <AmtrakPanel />
        </div>
      ) : (
        <>
          <header className="relative z-30 flex shrink-0 items-center justify-between gap-4 px-5 pt-3 pb-1">
            <div
              className="led-text text-[clamp(1.35rem,2.8vw,2.1rem)] tabular-nums tracking-wider"
              style={{
                textShadow: `0 0 ${6 + glow * 14}px rgba(255,176,0,${0.4 + glow * 0.4})`,
              }}
            >
              {timeLine}
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <StationHeader
                stationName={stationName || "Select station"}
                accentColor={settings.routeColor}
              />
              <span className="font-[family-name:var(--font-station)] text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                MBTA · {directionOpt.label}
              </span>
              <span
                className={`sr-only ${connected ? "text-emerald-500" : "text-red-500/80"}`}
                aria-live="polite"
              >
                {connected ? "Live data connected" : "Disconnected from live data"}
              </span>
            </div>

            <div className="min-w-[2.5rem]">
              {settings.weatherEnabled ? (
                <Weather data={weather.data} error={weather.error} glow={glow} />
              ) : (
                <div className="h-8" />
              )}
            </div>
          </header>

          <div className="relative z-30 flex shrink-0 items-end justify-between gap-3 border-b border-amber-900/30 px-5 pb-2">
            <BoardRouteControls
              settings={settings}
              compact
              hideMode
              hideDirection
              onChange={(patch) => setSettings({ ...settings, ...patch })}
            />
            <div className="flex shrink-0 items-end gap-2">
              <div className="flex min-w-[7rem] flex-col gap-1">
                <DirectionSelect
                  settings={settings}
                  compact
                  onChange={(patch) => setSettings({ ...settings, ...patch })}
                />
                {settings.stopId && (
                  <WalkToStation
                    stationId={settings.stopId}
                    stationName={settings.stopName}
                    walk={walk}
                  />
                )}
              </div>
              <Link
                href="/settings"
                className="led-text shrink-0 self-end pb-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-amber-800/80 hover:text-amber-500"
              >
                Settings
              </Link>
            </div>
          </div>

          <main
            className={`relative z-30 flex min-h-0 flex-1 flex-col px-5 ${
              showMiniMap ? "pb-1" : "pb-2"
            }`}
          >
            <div className="mb-1 flex items-end justify-between border-b border-amber-900/40 pb-1">
              <span className="led-text text-[0.7rem] uppercase tracking-[0.3em] text-amber-600/75">
                {directionOpt.label} arrivals
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {error && boardRows.length === 0 && (
                <div className="led-text py-8 text-center text-amber-600/90">{error}</div>
              )}
              {!error && boardRows.length === 0 && (
                <div className="led-text py-8 text-center text-amber-700/70">
                  {settings.stopId
                    ? "Waiting for predictions…"
                    : "Select a route and station"}
                </div>
              )}
              <AnimatePresence initial={false}>
                {boardRows.map((arrival, index) => (
                  <ArrivalRow
                    key={arrival.id}
                    arrival={arrival}
                    index={index}
                    glow={glow}
                  />
                ))}
              </AnimatePresence>
            </div>

            {error && boardRows.length > 0 && (
              <div className="led-text pt-1 text-[0.65rem] text-amber-700/70">{error}</div>
            )}
          </main>

          <ServiceFrequency
            schedules={schedules}
            arrivals={boardRows}
            nowMs={nowMs}
            glow={glow}
          />

          <LeaveForStationNow advice={leaveAdvice} />

          {showMiniMap && corridor && (
            <section className="relative z-30 h-[22vh] min-h-[132px] max-h-[200px] shrink-0 border-t border-amber-900/30 bg-gradient-to-b from-transparent to-emerald-950/20">
              <MiniMap
                trains={trains}
                glow={glow}
                corridor={corridor}
                routeColor={settings.routeColor}
                routeLabel={routeLabel}
                directionId={settings.directionId}
              />
            </section>
          )}

          <AnnouncementManager active={settings.announcementsEnabled} />
        </>
      )}
    </div>
  );
}
