"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GREEN_D_STATIONS, TARGET_STOP_ID } from "@/lib/mbta/stations";
import type { MapTrain } from "@/lib/mbta/types";

interface MiniMapProps {
  trains: MapTrain[];
  glow: number;
}

/** Simplified horizontal Green Line D map (~bottom 20% of the board). */
export function MiniMap({ trains, glow }: MiniMapProps) {
  const count = GREEN_D_STATIONS.length;
  // Show a readable subset of labels on tablet width.
  const labelEvery = 2;

  return (
    <div className="mini-map flex h-full flex-col justify-center px-4 pb-2 pt-1">
      <div
        className="led-text mb-2 text-center text-[0.7rem] uppercase tracking-[0.35em] text-amber-600/80"
        style={{ textShadow: `0 0 ${4 + glow * 8}px rgba(255,176,0,0.35)` }}
      >
        Green Line D · Riverside → Government Center
      </div>

      <div className="relative mx-auto w-full max-w-[96%] flex-1">
        {/* Track */}
        <div className="absolute left-0 right-0 top-[38%] h-[3px] rounded-full bg-gradient-to-r from-emerald-900 via-emerald-500/80 to-emerald-900 shadow-[0_0_10px_rgba(16,185,129,0.45)]" />

        {/* Station ticks + labels */}
        <div className="relative h-full">
          {GREEN_D_STATIONS.map((station, i) => {
            const left = `${(i / (count - 1)) * 100}%`;
            const isHere = station.id === TARGET_STOP_ID;
            const showLabel = i % labelEvery === 0 || isHere || i === count - 1;
            return (
              <div
                key={station.id}
                className="absolute top-[38%] -translate-x-1/2 -translate-y-1/2"
                style={{ left }}
              >
                <div
                  className={`h-2.5 w-2.5 rounded-full border ${
                    isHere
                      ? "border-amber-300 bg-amber-400 shadow-[0_0_10px_rgba(255,176,0,0.9)]"
                      : "border-emerald-400/70 bg-black"
                  }`}
                />
                {showLabel && (
                  <div
                    className={`absolute left-1/2 top-4 w-16 -translate-x-1/2 text-center text-[0.55rem] leading-tight tracking-wide ${
                      isHere ? "text-amber-300" : "text-emerald-500/70"
                    }`}
                  >
                    {station.shortName}
                  </div>
                )}
              </div>
            );
          })}

          {/* Trains */}
          <AnimatePresence>
            {trains.map((train) => {
              const max = count - 1;
              const pos = Math.min(max, Math.max(0, train.stationIndex + train.progress));
              const left = `${(pos / max) * 100}%`;
              const inbound = train.directionId === 1;

              return (
                <motion.div
                  key={train.id}
                  className="absolute top-[38%] z-10 -translate-x-1/2 -translate-y-1/2"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ left, opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 60, damping: 18, mass: 0.8 }}
                  title={`${train.label ?? "Train"} · ${inbound ? "Inbound" : "Outbound"}`}
                >
                  <div className="relative">
                    <div className="h-3.5 w-3.5 rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.95)] animate-train-glow" />
                    <div
                      className={`absolute -top-3 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[4px] border-r-[4px] border-transparent ${
                        inbound
                          ? "border-l-emerald-300"
                          : "border-r-emerald-300"
                      }`}
                      aria-hidden
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
