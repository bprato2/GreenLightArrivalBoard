"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchNetworkRouteCatalog,
  fetchRoutesAtStop,
  type NetworkRouteEntry,
} from "@/lib/mbta/catalog";
import { GREEN_LINE_ALL_ID, GREEN_LINE_BRANCH_IDS, GREEN_LINE_COLOR } from "@/lib/mbta/boardConfig";
import type { TransitMode } from "@/lib/providers/types";

export interface RouteSelection {
  mode: TransitMode;
  routeId: string;
  routeColor: string;
  /** True when the route serves the current departure station. */
  keepStop: boolean;
}

interface RouteSelectProps {
  mode: TransitMode;
  routeId: string;
  stopId: string;
  stopName?: string;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  onSelect: (selection: RouteSelection) => void;
}

interface PanelPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

function routeTitle(entry: NetworkRouteEntry): string {
  if (entry.routeId === GREEN_LINE_ALL_ID) return "Green Line (all)";
  if (entry.routeId.startsWith("Green-")) {
    return `Green Line ${entry.routeId.replace("Green-", "")}`;
  }
  if (entry.routeShortName && entry.routeShortName !== entry.routeLabel) {
    return `${entry.routeShortName} · ${entry.routeLabel}`;
  }
  return entry.routeLabel;
}

function greenBranchFallback(branchId: string): NetworkRouteEntry {
  const letter = branchId.replace("Green-", "");
  return {
    key: `subway::${branchId}`,
    mode: "subway",
    modeLabel: "Subway",
    routeId: branchId,
    routeLabel: `Green Line ${letter}`,
    routeShortName: letter,
    routeColor: GREEN_LINE_COLOR,
  };
}

/** Prefer Green Line (all), then B/C/D/E, then everything else. */
function sortRouteEntries(entries: NetworkRouteEntry[]): NetworkRouteEntry[] {
  const greenOrder = [GREEN_LINE_ALL_ID, ...GREEN_LINE_BRANCH_IDS];
  return [...entries].sort((a, b) => {
    const ai = greenOrder.indexOf(a.routeId as (typeof greenOrder)[number]);
    const bi = greenOrder.indexOf(b.routeId as (typeof greenOrder)[number]);
    if (ai >= 0 || bi >= 0) {
      if (ai < 0) return 1;
      if (bi < 0) return -1;
      return ai - bi;
    }
    return (
      a.modeLabel.localeCompare(b.modeLabel) ||
      a.routeLabel.localeCompare(b.routeLabel)
    );
  });
}

/**
 * Route picker: routes that serve the selected departure station first,
 * then the full network (grayscale). Portal-mounted for scroll under the board shell.
 */
export function RouteSelect({
  mode,
  routeId,
  stopId,
  stopName,
  compact = false,
  disabled = false,
  className = "",
  onSelect,
}: RouteSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const [atStop, setAtStop] = useState<NetworkRouteEntry[]>([]);
  const [network, setNetwork] = useState<NetworkRouteEntry[]>([]);
  const [loadingAtStop, setLoadingAtStop] = useState(false);
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    void fetchNetworkRouteCatalog()
      .then((list) => {
        if (!cancelled) setNetwork(list);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load routes");
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
    if (!stopId) {
      setAtStop([]);
      setLoadingAtStop(false);
      return;
    }
    let cancelled = false;
    setLoadingAtStop(true);
    void fetchRoutesAtStop(stopId)
      .then((list) => {
        if (!cancelled) setAtStop(list);
      })
      .catch(() => {
        if (!cancelled) setAtStop([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAtStop(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, stopId]);

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

  const q = filter.trim().toLowerCase();

  const atStopFiltered = useMemo(() => {
    const list = !q
      ? atStop
      : atStop.filter((e) => {
          const hay = `${e.modeLabel} ${e.routeLabel} ${e.routeShortName ?? ""} ${e.routeId}`.toLowerCase();
          return hay.includes(q);
        });
    return sortRouteEntries(list);
  }, [atStop, q]);

  const atStopIds = useMemo(
    () => new Set(atStop.map((e) => e.routeId)),
    [atStop],
  );

  const otherRoutes = useMemo(() => {
    const byId = new Map(network.map((e) => [e.routeId, e]));
    // Guarantee Green B/C/D/E exist in the subway catalog for selection.
    if (mode === "subway") {
      for (const branchId of GREEN_LINE_BRANCH_IDS) {
        if (!byId.has(branchId)) {
          byId.set(branchId, greenBranchFallback(branchId));
        }
      }
    }

    const list = [...byId.values()].filter((entry) => {
      // At-station routes stay in the top section — except keep every Green
      // branch listed under All subway so B/C/D/E are always easy to pick.
      if (atStopIds.has(entry.routeId)) {
        const isGreenBranch = entry.routeId.startsWith("Green-");
        if (!isGreenBranch) return false;
      }
      if (!q && entry.mode !== mode) return false;
      if (!q) return true;
      const hay = `${entry.modeLabel} ${entry.routeLabel} ${entry.routeShortName ?? ""} ${entry.routeId}`.toLowerCase();
      return hay.includes(q);
    });

    return sortRouteEntries(list);
  }, [network, atStopIds, q, mode]);

  const modeSectionLabel =
    mode === "commuter_rail"
      ? "All commuter rail"
      : mode === "bus"
        ? "All bus"
        : "All subway";

  const selectedEntry =
    atStop.find((e) => e.routeId === routeId) ??
    network.find((e) => e.routeId === routeId);

  const displayName = selectedEntry
    ? routeTitle(selectedEntry)
    : routeId || "Select route";

  const triggerClass = compact
    ? "rounded border border-amber-900/50 bg-black px-2 py-1.5 text-left text-[0.65rem] uppercase tracking-wide text-amber-200 outline-none focus:border-amber-500 disabled:opacity-50 min-w-[7rem] max-w-[14rem]"
    : "rounded border border-amber-900/50 bg-black px-2 py-1.5 text-left text-amber-200 outline-none focus:border-amber-500 disabled:opacity-50 w-full";

  const pick = (entry: NetworkRouteEntry, keepStop: boolean) => {
    onSelect({
      mode: entry.mode,
      routeId: entry.routeId,
      routeColor: entry.routeColor,
      keepStop,
    });
    setOpen(false);
    setFilter("");
  };

  const atStopHeading = stopName
    ? `At ${stopName}`
    : stopId
      ? "At this station"
      : "At this station";

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
            placeholder="Search all modes…"
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
            {atStopHeading}
          </div>
          {!stopId && (
            <div className="px-3 py-2 text-sm text-zinc-500">
              Select a departure station to see routes that stop there
            </div>
          )}
          {stopId && loadingAtStop && atStop.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-500">Loading…</div>
          )}
          {stopId && !loadingAtStop && atStopFiltered.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-500">No matches</div>
          )}
          {atStopFiltered.map((entry) => {
            const selected = entry.routeId === routeId && entry.mode === mode;
            return (
              <button
                key={`at-${entry.key}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full flex-col gap-0.5 px-3 py-1.5 text-left transition-colors ${
                  selected
                    ? "bg-amber-950/80 text-amber-200"
                    : "text-amber-100/90 hover:bg-amber-950/40"
                }`}
                onClick={() => pick(entry, true)}
              >
                <span className="text-[0.65rem] uppercase tracking-[0.14em] text-amber-700/80">
                  {entry.modeLabel}
                </span>
                <span className="text-sm">{routeTitle(entry)}</span>
              </button>
            );
          })}

          <div className="sticky top-0 z-10 mt-1 border-t border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[0.6rem] uppercase tracking-[0.18em] text-zinc-500">
            {q ? "Search results" : modeSectionLabel}
          </div>
          {loadingNetwork && network.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-600">Loading network…</div>
          )}
          {error && (
            <div className="px-3 py-2 text-sm text-zinc-500">{error}</div>
          )}
          {!loadingNetwork && !error && otherRoutes.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-600">No matches</div>
          )}
          {otherRoutes.map((entry) => {
            const selected = entry.routeId === routeId && entry.mode === mode;
            return (
              <button
                key={`all-${entry.key}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full flex-col gap-0.5 px-3 py-1.5 text-left transition-colors ${
                  selected
                    ? "bg-zinc-800 text-zinc-200"
                    : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                }`}
                onClick={() => pick(entry, false)}
              >
                <span className="text-[0.65rem] uppercase tracking-[0.14em] text-zinc-600">
                  {entry.modeLabel}
                </span>
                <span className="text-sm text-zinc-400">{routeTitle(entry)}</span>
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
        disabled={disabled}
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
