"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  MINI_MAP_HAS_CONTINUATION,
  MINI_MAP_STATIONS,
  TARGET_STOP_ID,
} from "@/lib/mbta/stations";
import type { MapTrain } from "@/lib/mbta/types";

interface MiniMapProps {
  trains: MapTrain[];
  glow: number;
}

function HomeMarker() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className="absolute -top-5 left-1/2 -translate-x-1/2 text-amber-300"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M7 1.5 1.5 6v6.5h3.5V9.5h4V12.5H12.5V6L7 1.5Z"
      />
    </svg>
  );
}

function TramIcon({ inbound }: { inbound: boolean }) {
  return (
    <svg
      width="18"
      height="12"
      viewBox="0 0 18 12"
      className={`drop-shadow-[0_0_6px_rgba(52,211,153,0.85)] ${inbound ? "" : "scale-x-[-1]"}`}
      aria-hidden
    >
      <rect x="1" y="2" width="16" height="7" rx="1.5" fill="#6ee7b7" />
      <rect x="3" y="3.5" width="4" height="3" rx="0.5" fill="#022c22" opacity="0.55" />
      <rect x="11" y="3.5" width="4" height="3" rx="0.5" fill="#022c22" opacity="0.55" />
      <circle cx="4.5" cy="10" r="1.2" fill="#a7f3d0" />
      <circle cx="13.5" cy="10" r="1.2" fill="#a7f3d0" />
      <path d="M9 0.5v2" stroke="#6ee7b7" strokeWidth="1.2" />
    </svg>
  );
}

/** Green Line D map — Riverside through Chestnut Hill with continuation marker. */
export function MiniMap({ trains, glow }: MiniMapProps) {
  const stationCount = MINI_MAP_STATIONS.length;
  const segmentCount = stationCount - 1 + (MINI_MAP_HAS_CONTINUATION ? 0.35 : 0);

  const stationLeft = (index: number) => `${(index / segmentCount) * 100}%`;
  const continuationLeft = `${((stationCount - 1 + 0.35) / segmentCount) * 100}%`;

  return (
    <div className="mini-map flex h-full flex-col justify-center px-4 pb-2 pt-1">
      <div
        className="led-text mb-2 text-center text-[0.7rem] uppercase tracking-[0.35em] text-amber-600/80"
        style={{ textShadow: `0 0 ${4 + glow * 8}px rgba(255,176,0,0.35)` }}
      >
        Green Line D · Riverside → Chestnut Hill
      </div>

      <div className="relative mx-auto w-full max-w-[96%] flex-1">
        <div
          className="absolute left-0 top-[38%] h-[3px] rounded-full bg-gradient-to-r from-emerald-900 via-emerald-500/80 to-emerald-900 shadow-[0_0_10px_rgba(16,185,129,0.45)]"
          style={{ right: MINI_MAP_HAS_CONTINUATION ? "2%" : "0" }}
        />

        <div className="relative h-full">
          {MINI_MAP_STATIONS.map((station, i) => {
            const isHome = station.id === TARGET_STOP_ID;
            return (
              <div
                key={station.id}
                className="absolute top-[38%] -translate-x-1/2 -translate-y-1/2"
                style={{ left: stationLeft(i) }}
              >
                {isHome && <HomeMarker />}
                <div
                  className={`h-2.5 w-2.5 rounded-full border ${
                    isHome
                      ? "border-amber-300 bg-amber-400"
                      : "border-emerald-400/70 bg-black"
                  }`}
                />
                <div
                  className={`absolute left-1/2 top-4 w-16 -translate-x-1/2 text-center text-[0.55rem] leading-tight tracking-wide ${
                    isHome ? "text-amber-300" : "text-emerald-500/70"
                  }`}
                >
                  {station.shortName}
                </div>
              </div>
            );
          })}

          {MINI_MAP_HAS_CONTINUATION && (
            <div
              className="absolute top-[38%] -translate-x-1/2 -translate-y-1/2 text-[0.85rem] tracking-[0.35em] text-emerald-500/55"
              style={{ left: continuationLeft }}
              aria-hidden
            >
              ···
            </div>
          )}

          <AnimatePresence>
            {trains.map((train) => {
              const pos = Math.min(
                segmentCount,
                Math.max(0, train.stationIndex + train.progress),
              );
              const left = `${(pos / segmentCount) * 100}%`;
              const inbound = train.directionId === 1;

              return (
                <motion.div
                  key={train.id}
                  className="absolute top-[38%] z-10 -translate-x-1/2 -translate-y-1/2"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ left, opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 60, damping: 18, mass: 0.8 }}
                  title={`${train.label ?? "Train"} · Inbound`}
                >
                  <TramIcon inbound={inbound} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
