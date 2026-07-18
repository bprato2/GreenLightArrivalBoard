"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchNetworkStopCatalog,
  type NetworkStopEntry,
} from "@/lib/mbta/catalog";
import type { TransitMode, TransitStop } from "@/lib/providers/types";

export interface DepartureStationSelection {
  stopId: string;
  stopName: string;
  stopLat: number;
  stopLon: number;
  /** Present when jumping from the all-network section. */
  mode?: TransitMode;
  routeId?: string;
  routeColor?: string;
}

interface DepartureStationSelectProps {
  routeId: string;
  stopId: string;
  stopName: string;
  routeStops: TransitStop[];
  loadingRouteStops: boolean;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  onSelect: (selection: DepartureStationSelection) => void;
}

interface PanelPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * Departure station picker: current-line stops on top, then a scrollable
 * grayscale “all stations” list (mode · line · stop) for the rest of the network.
 * Renders in a portal so the board shell’s overflow:hidden does not clip scrolling.
 */
export function DepartureStationSelect({
  routeId,
  stopId,
  stopName,
  routeStops,
  loadingRouteStops,
  compact = false,
  disabled = false,
  className = "",
  onSelect,
}: DepartureStationSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const [network, setNetwork] = useState<NetworkStopEntry[]>([]);
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - width - 8,
    );
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const preferBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(352, Math.max(160, preferBelow ? spaceBelow : spaceAbove));
    const top = preferBelow
      ? rect.bottom + 4
      : Math.max(8, rect.top - maxHeight - 4);
    setPos({ top, left, width, maxHeight });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
    const onWin = () => updatePosition();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingNetwork(true);
    setNetworkError(null);
    void fetchNetworkStopCatalog()
      .then((list) => {
        if (!cancelled) setNetwork(list);
      })
      .catch(() => {
        if (!cancelled) setNetworkError("Could not load all stations");
      })
      .finally(() => {
        if (!cancelled) setLoadingNetwork(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const routeStopIds = useMemo(
    () => new Set(routeStops.map((s) => s.id)),
    [routeStops],
  );

  const q = filter.trim().toLowerCase();

  const currentStops = useMemo(() => {
    if (!q) return routeStops;
    return routeStops.filter((s) => s.name.toLowerCase().includes(q));
  }, [routeStops, q]);

  const otherStops = useMemo(() => {
    return network.filter((entry) => {
      if (entry.routeId === routeId && routeStopIds.has(entry.stopId)) {
        return false;
      }
      if (!q) return true;
      const hay = `${entry.stopName} ${entry.modeLabel} ${entry.routeLabel}`.toLowerCase();
      return hay.includes(q);
    });
  }, [network, routeId, routeStopIds, q]);

  const displayName =
    stopName ||
    routeStops.find((s) => s.id === stopId)?.name ||
    (stopId ? stopId : "Select station");

  const triggerClass = compact
    ? "rounded border border-amber-900/50 bg-black px-2 py-1.5 text-left text-[0.65rem] uppercase tracking-wide text-amber-200 outline-none focus:border-amber-500 disabled:opacity-50 min-w-[7rem] max-w-[14rem]"
    : "rounded border border-amber-900/50 bg-black px-2 py-1.5 text-left text-amber-200 outline-none focus:border-amber-500 disabled:opacity-50 w-full";

  const pickCurrent = (stop: TransitStop) => {
    onSelect({
      stopId: stop.id,
      stopName: stop.name,
      stopLat: stop.lat,
      stopLon: stop.lon,
    });
    setOpen(false);
    setFilter("");
  };

  const pickOther = (entry: NetworkStopEntry) => {
    onSelect({
      stopId: entry.stopId,
      stopName: entry.stopName,
      stopLat: entry.lat,
      stopLon: entry.lon,
      mode: entry.mode,
      routeId: entry.routeId,
      routeColor: entry.routeColor,
    });
    setOpen(false);
    setFilter("");
  };

  const panel =
    open &&
    pos &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={panelRef}
        id={listId}
        role="listbox"
        className="fixed z-[200] flex flex-col overflow-hidden rounded border border-amber-900/60 bg-zinc-950 shadow-[0_12px_40px_rgba(0,0,0,0.65)]"
        style={{
          top: pos.top,
          left: pos.left,
          width: pos.width,
          maxHeight: pos.maxHeight,
          // Allow pan/scroll inside the kiosk shell (body uses touch-action: manipulation).
          touchAction: "pan-y",
        }}
        data-allow-scroll="true"
      >
        <div className="shrink-0 border-b border-zinc-800 p-2">
          <input
            autoFocus
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter stations…"
            className="w-full rounded border border-zinc-700 bg-black px-2 py-1.5 text-sm text-amber-100 outline-none placeholder:text-zinc-600 focus:border-amber-600"
            style={{ userSelect: "text", touchAction: "manipulation" }}
          />
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 bg-zinc-950 px-2 py-1.5 text-[0.6rem] uppercase tracking-[0.18em] text-amber-600/90">
            On this line
          </div>
          {loadingRouteStops && routeStops.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-500">Loading…</div>
          )}
          {!loadingRouteStops && currentStops.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-500">No matches</div>
          )}
          {currentStops.map((stop) => {
            const selected = stop.id === stopId;
            return (
              <button
                key={`current-${stop.id}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full px-3 py-1.5 text-left text-sm transition-colors ${
                  selected
                    ? "bg-amber-950/80 text-amber-200"
                    : "text-amber-100/90 hover:bg-amber-950/40"
                }`}
                onClick={() => pickCurrent(stop)}
              >
                {stop.name}
              </button>
            );
          })}

          <div className="sticky top-0 z-10 mt-1 border-t border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[0.6rem] uppercase tracking-[0.18em] text-zinc-500">
            All stations
          </div>
          {loadingNetwork && network.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-600">
              Loading network…
            </div>
          )}
          {networkError && (
            <div className="px-3 py-2 text-sm text-zinc-500">{networkError}</div>
          )}
          {!loadingNetwork && !networkError && otherStops.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-600">No matches</div>
          )}
          {otherStops.map((entry) => {
            const selected =
              entry.stopId === stopId && entry.routeId === routeId;
            return (
              <button
                key={entry.key}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full flex-col gap-0.5 px-3 py-1.5 text-left transition-colors ${
                  selected
                    ? "bg-zinc-800 text-zinc-200"
                    : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                }`}
                onClick={() => pickOther(entry)}
              >
                <span className="text-[0.65rem] uppercase tracking-[0.14em] text-zinc-600">
                  {entry.modeLabel} · {entry.routeLabel}
                </span>
                <span className="text-sm text-zinc-400">{entry.stopName}</span>
              </button>
            );
          })}
        </div>
      </div>,
      document.body,
    );

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`${triggerClass} flex w-full items-center justify-between gap-2`}
        disabled={disabled || (loadingRouteStops && routeStops.length === 0)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{displayName}</span>
        <span className="shrink-0 text-amber-700" aria-hidden>
          ▾
        </span>
      </button>
      {panel}
    </div>
  );
}
