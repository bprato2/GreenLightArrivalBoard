"use client";

import type { CSSProperties } from "react";
import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrivalIndicator } from "@/components/ArrivalIndicator";
import { ArrivalRow } from "@/components/ArrivalRow";
import { AnnouncementManager } from "@/components/AnnouncementManager";
import { MiniMap } from "@/components/MiniMap";
import { Weather } from "@/components/Weather";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useArrivalAlert } from "@/hooks/useArrivalAlert";
import { useClock } from "@/hooks/useClock";
import { useMbtaStream } from "@/hooks/useMbtaStream";
import { useSettings } from "@/hooks/useSettings";
import { useWeather } from "@/hooks/useWeather";
import { TARGET_STATION_NAME } from "@/lib/mbta/stations";

export function ArrivalBoard() {
  const { settings, hydrated } = useSettings();
  const { arrivals, trains, connected, error } = useMbtaStream();
  const { timeLine } = useClock();
  const weather = useWeather(settings.weatherEnabled);
  const closestInbound =
    arrivals.find((a) => a.directionId === 1)?.minutesAway ?? null;
  const alert = useArrivalAlert(closestInbound, settings);
  useAnnouncements(arrivals, settings.announcementsEnabled);

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

      {/* Header ~ compact */}
      <header className="relative z-30 flex shrink-0 items-center justify-between gap-4 px-5 pt-3 pb-1">
        <div
          className="led-text text-[clamp(1.35rem,2.8vw,2.1rem)] tabular-nums tracking-wider"
          style={{ textShadow: `0 0 ${6 + glow * 14}px rgba(255,176,0,${0.4 + glow * 0.4})` }}
        >
          {timeLine}
        </div>

        <div className="flex flex-col items-center gap-2">
          <div
            className="led-text text-center text-[clamp(1.4rem,3.2vw,2.4rem)] font-semibold uppercase tracking-[0.18em]"
            style={{ textShadow: `0 0 ${8 + glow * 16}px rgba(255,176,0,${0.45 + glow * 0.4})` }}
          >
            {TARGET_STATION_NAME}
          </div>
          <div className="flex items-center gap-3">
            <ArrivalIndicator phase={alert.phase} />
            <span className="led-text text-[0.65rem] uppercase tracking-[0.25em] text-amber-600/80">
              Green Line D
            </span>
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-red-500/80"}`}
              title={connected ? "Live" : "Disconnected"}
              aria-label={connected ? "Connected" : "Disconnected"}
            />
          </div>
        </div>

        <div className="min-w-[7rem]">
          {settings.weatherEnabled ? (
            <Weather data={weather.data} error={weather.error} glow={glow} />
          ) : (
            <div className="h-10" />
          )}
        </div>
      </header>

      {/* Arrivals — fills remaining space above mini-map */}
      <main
        className={`relative z-30 flex min-h-0 flex-1 flex-col px-5 ${
          settings.miniMapEnabled ? "pb-1" : "pb-4"
        }`}
      >
        <div className="mb-1 flex items-end justify-between border-b border-amber-900/40 pb-1">
          <span className="led-text text-[0.7rem] uppercase tracking-[0.3em] text-amber-600/75">
            Next arrivals
          </span>
          <Link
            href="/settings"
            className="led-text text-[0.65rem] uppercase tracking-[0.2em] text-amber-800/80 hover:text-amber-500"
          >
            Settings
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {error && arrivals.length === 0 && (
            <div className="led-text py-8 text-center text-amber-600/90">{error}</div>
          )}
          {!error && arrivals.length === 0 && (
            <div className="led-text py-8 text-center text-amber-700/70">
              Waiting for predictions…
            </div>
          )}
          <AnimatePresence initial={false}>
            {arrivals.slice(0, 6).map((arrival, index) => (
              <ArrivalRow
                key={arrival.id}
                arrival={arrival}
                index={index}
                glow={glow}
              />
            ))}
          </AnimatePresence>
        </div>

        {error && arrivals.length > 0 && (
          <div className="led-text pt-1 text-[0.65rem] text-amber-700/70">{error}</div>
        )}
      </main>

      {settings.miniMapEnabled && (
        <section className="relative z-30 h-[20vh] min-h-[120px] max-h-[180px] shrink-0 border-t border-amber-900/30 bg-gradient-to-b from-transparent to-emerald-950/20">
          <MiniMap trains={trains} glow={glow} />
        </section>
      )}

      <AnnouncementManager active={settings.announcementsEnabled} />
    </div>
  );
}
