"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type StationInfo } from "@/lib/mbta/stations";
import type { MiniMapCorridor } from "@/lib/mbta/corridor";
import type { MapTrain } from "@/lib/mbta/types";

interface MiniMapProps {
  trains: MapTrain[];
  glow: number;
  corridor: MiniMapCorridor;
  /** Accent color for the track / trains. */
  routeColor: string;
  /** Short label for the title (e.g. "Orange", "Green Line D"). */
  routeLabel: string;
  /** 1 = inbound, 0 = outbound. */
  directionId: number;
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

function TramIcon({ inbound, color }: { inbound: boolean; color: string }) {
  return (
    <svg
      width="18"
      height="12"
      viewBox="0 0 18 12"
      className={inbound ? "" : "scale-x-[-1]"}
      style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      aria-hidden
    >
      <rect x="1" y="2" width="16" height="7" rx="1.5" fill={color} />
      <rect x="3" y="3.5" width="4" height="3" rx="0.5" fill="#022c22" opacity="0.55" />
      <rect x="11" y="3.5" width="4" height="3" rx="0.5" fill="#022c22" opacity="0.55" />
      <circle cx="4.5" cy="10" r="1.2" fill="#a7f3d0" />
      <circle cx="13.5" cy="10" r="1.2" fill="#a7f3d0" />
      <path d="M9 0.5v2" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

function corridorTitle(stations: StationInfo[], routeLabel: string): string {
  if (stations.length === 0) return routeLabel;
  const first = stations[0]!.shortName;
  const last = stations[stations.length - 1]!.shortName;
  return `${routeLabel} · ${first} → ${last}`;
}

function trackGlow(color: string): string {
  // Soften track shadow toward the route color without needing color-mix support.
  return `0 0 10px ${color}73`;
}

/** Corridor map with leg times and animated trains for any selected route. */
export function MiniMap({
  trains,
  glow,
  corridor,
  routeColor,
  routeLabel,
  directionId,
}: MiniMapProps) {
  const { stations, hasContinuation, homeStopId } = corridor;
  const stationCount = stations.length;
  const segmentCount = Math.max(1, stationCount - 1 + (hasContinuation ? 0.35 : 0));
  const corridorStart = stations[0]?.index ?? 0;
  const color = routeColor || "#888888";
  const inbound = directionId === 1;

  const stationLeft = (index: number) => `${(index / segmentCount) * 100}%`;
  const segmentMidLeft = (index: number) => `${((index + 0.5) / segmentCount) * 100}%`;
  const continuationLeft = `${((stationCount - 1 + 0.35) / segmentCount) * 100}%`;

  return (
    <div className="mini-map flex h-full flex-col justify-center px-3 pb-1 pt-1">
      <div
        className="led-text mb-1.5 text-center text-[0.65rem] uppercase tracking-[0.28em] text-amber-600/80"
        style={{ textShadow: `0 0 ${4 + glow * 8}px rgba(255,176,0,0.35)` }}
      >
        {corridorTitle(stations, routeLabel)}
      </div>

      <div className="relative mx-auto w-full max-w-[98%] flex-1">
        <div
          className="absolute left-0 top-[36%] h-[3px] rounded-full"
          style={{
            right: hasContinuation ? "2%" : "0",
            background: `linear-gradient(90deg, #1a1a1a, ${color}cc, #1a1a1a)`,
            boxShadow: trackGlow(color),
          }}
        />

        <div className="relative h-full">
          {stations.map((station, i) => {
            const isHome = station.id === homeStopId;
            return (
              <div
                key={station.id}
                className="absolute top-[36%] -translate-x-1/2 -translate-y-1/2"
                style={{ left: stationLeft(i) }}
              >
                {isHome && <HomeMarker />}
                <div
                  className={`h-2.5 w-2.5 rounded-full border ${
                    isHome ? "border-amber-300 bg-amber-400" : "bg-black"
                  }`}
                  style={
                    isHome
                      ? undefined
                      : { borderColor: `${color}b3` }
                  }
                />
                <div
                  className={`absolute left-1/2 top-3.5 w-[3.1rem] -translate-x-1/2 text-center text-[0.5rem] leading-tight tracking-wide ${
                    isHome ? "text-amber-300" : "text-zinc-500"
                  }`}
                  style={isHome ? undefined : { color: `${color}b3` }}
                >
                  {station.shortName}
                </div>
              </div>
            );
          })}

          {stations.slice(0, -1).map((station, i) => (
            <div
              key={`leg-${station.id}-${i}`}
              className="absolute top-[18%] -translate-x-1/2 text-center"
              style={{ left: segmentMidLeft(i) }}
              title={`≈ ${station.minutesToNext} min to ${stations[i + 1]!.shortName}`}
            >
              <span className="led-text text-[0.5rem] tabular-nums tracking-wide text-amber-500/75">
                {station.minutesToNext}&prime;
              </span>
            </div>
          ))}

          {hasContinuation && (
            <div
              className="absolute top-[36%] -translate-x-1/2 -translate-y-1/2 text-[0.85rem] tracking-[0.35em] text-zinc-600"
              style={{ left: continuationLeft, color: `${color}8c` }}
              aria-hidden
            >
              ···
            </div>
          )}

          <AnimatePresence initial={false}>
            {trains.map((train) => {
              const relative = train.stationIndex - corridorStart;
              const pos = Math.min(
                segmentCount,
                Math.max(0, relative + train.progress),
              );
              const left = `${(pos / segmentCount) * 100}%`;

              return (
                <motion.div
                  key={train.id}
                  className="absolute top-[36%] z-10 -translate-x-1/2 -translate-y-1/2"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ left, opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{
                    left: { type: "spring", stiffness: 60, damping: 18, mass: 0.8 },
                    opacity: { duration: 0.25 },
                    scale: { duration: 0.25 },
                  }}
                  title={`${train.label ?? "Train"} · ${inbound ? "Inbound" : "Outbound"}`}
                >
                  <TramIcon inbound={inbound} color={color} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
