"use client";

import type { CSSProperties } from "react";
import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrivalRow } from "@/components/ArrivalRow";
import { AnnouncementManager } from "@/components/AnnouncementManager";
import { LeaveForStationNow } from "@/components/LeaveForStationNow";
import { MiniMap } from "@/components/MiniMap";
import { ServiceFrequency } from "@/components/ServiceFrequency";
import { StationHeader } from "@/components/StationHeader";
import { Weather } from "@/components/Weather";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useClock } from "@/hooks/useClock";
import { useMbtaSchedules } from "@/hooks/useMbtaSchedules";
import { useMbtaStream } from "@/hooks/useMbtaStream";
import { useSettings } from "@/hooks/useSettings";
import { useWeather } from "@/hooks/useWeather";
import { TARGET_STATION_NAME } from "@/lib/mbta/stations";
import type { Arrival } from "@/lib/mbta/types";

function mergeBoardRows(live: Arrival[], scheduled: Arrival[]): Arrival[] {
  return [...live, ...scheduled];
}

export function ArrivalBoard() {
  const { settings, hydrated } = useSettings();
  const { arrivals, trains, connected, error, nowMs } = useMbtaStream();
  const { scheduled, schedules } = useMbtaSchedules(arrivals, nowMs);
  const boardRows = mergeBoardRows(arrivals, scheduled);
  const { timeLine } = useClock();
  const weather = useWeather(settings.weatherEnabled);
  const closestInbound = arrivals[0]?.minutesAway ?? null;
  const showLeaveNow =
    closestInbound !== null &&
    closestInbound >= settings.alertPulseMinMinutes &&
    closestInbound <= settings.alertPulseMaxMinutes;

  const { needsGesture, enableFromGesture } = useAnnouncements(
    arrivals,
    settings.announcementsEnabled,
  );

  const glow = settings.ledGlowIntensity;

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

      <header className="relative z-30 flex shrink-0 items-center justify-between gap-4 px-5 pt-3 pb-1">
        <div
          className="led-text text-[clamp(1.35rem,2.8vw,2.1rem)] tabular-nums tracking-wider"
          style={{ textShadow: `0 0 ${6 + glow * 14}px rgba(255,176,0,${0.4 + glow * 0.4})` }}
        >
          {timeLine}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <StationHeader stationName={TARGET_STATION_NAME} />
          <span className="font-[family-name:var(--font-station)] text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Green Line · D Branch
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

      <main
        className={`relative z-30 flex min-h-0 flex-1 flex-col px-5 ${
          settings.miniMapEnabled ? "pb-1" : "pb-2"
        }`}
      >
        <div className="mb-1 flex items-end justify-between border-b border-amber-900/40 pb-1">
          <span className="led-text text-[0.7rem] uppercase tracking-[0.3em] text-amber-600/75">
            Inbound arrivals
          </span>
          <Link
            href="/settings"
            className="led-text text-[0.65rem] uppercase tracking-[0.2em] text-amber-800/80 hover:text-amber-500"
          >
            Settings
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {error && boardRows.length === 0 && (
            <div className="led-text py-8 text-center text-amber-600/90">{error}</div>
          )}
          {!error && boardRows.length === 0 && (
            <div className="led-text py-8 text-center text-amber-700/70">
              Waiting for predictions…
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

      <ServiceFrequency schedules={schedules} nowMs={nowMs} glow={glow} />

      <LeaveForStationNow visible={showLeaveNow} />

      {settings.miniMapEnabled && (
        <section className="relative z-30 h-[20vh] min-h-[120px] max-h-[180px] shrink-0 border-t border-amber-900/30 bg-gradient-to-b from-transparent to-emerald-950/20">
          <MiniMap trains={trains} glow={glow} />
        </section>
      )}

      <AnnouncementManager
        active={settings.announcementsEnabled}
        needsGesture={needsGesture}
        onEnable={enableFromGesture}
      />
    </div>
  );
}
