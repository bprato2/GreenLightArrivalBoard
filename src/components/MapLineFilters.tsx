"use client";

import type { NetworkRouteEntry } from "@/lib/mbta/catalog";
import type { TransitMode } from "@/lib/providers/types";

export type MapLineScope = "mode" | "all";

interface MapLineFiltersProps {
  entries: NetworkRouteEntry[];
  visibleIds: Set<string>;
  activeRouteId: string;
  scope: MapLineScope;
  mode: TransitMode;
  onScopeChange: (scope: MapLineScope) => void;
  onToggle: (routeId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onActivate: (entry: NetworkRouteEntry) => void;
}

function entryTitle(entry: NetworkRouteEntry): string {
  if (entry.routeId.startsWith("Green-")) {
    return `Green Line ${entry.routeId.replace("Green-", "")}`;
  }
  if (entry.routeShortName && entry.routeShortName !== entry.routeLabel) {
    return `${entry.routeShortName} · ${entry.routeLabel}`;
  }
  return entry.routeLabel;
}

/** Checkbox list of lines to show on the map + activate for stations. */
export function MapLineFilters({
  entries,
  visibleIds,
  activeRouteId,
  scope,
  mode,
  onScopeChange,
  onToggle,
  onSelectAll,
  onClearAll,
  onActivate,
}: MapLineFiltersProps) {
  const visibleCount = entries.filter((e) => visibleIds.has(e.routeId)).length;

  return (
    <div
      className="flex max-h-[28vh] min-h-[7rem] w-full flex-col rounded border border-amber-900/40 bg-black/80"
      data-allow-scroll="true"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-900/30 px-2 py-1.5">
        <span className="led-text text-[0.5rem] uppercase tracking-[0.2em] text-amber-700/80">
          Show lines
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            className={`led-text rounded px-2 py-0.5 text-[0.55rem] uppercase tracking-wide ${
              scope === "mode"
                ? "bg-amber-800/50 text-amber-200"
                : "text-amber-700 hover:text-amber-400"
            }`}
            onClick={() => onScopeChange("mode")}
          >
            {mode === "commuter_rail"
              ? "This mode"
              : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
          <button
            type="button"
            className={`led-text rounded px-2 py-0.5 text-[0.55rem] uppercase tracking-wide ${
              scope === "all"
                ? "bg-amber-800/50 text-amber-200"
                : "text-amber-700 hover:text-amber-400"
            }`}
            onClick={() => onScopeChange("all")}
          >
            All lines
          </button>
        </div>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            className="led-text text-[0.5rem] uppercase tracking-wide text-amber-600 hover:text-amber-400"
            onClick={onSelectAll}
          >
            All
          </button>
          <button
            type="button"
            className="led-text text-[0.5rem] uppercase tracking-wide text-amber-600 hover:text-amber-400"
            onClick={onClearAll}
          >
            None
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1" data-allow-scroll="true">
        {entries.length === 0 ? (
          <p className="px-2 py-3 text-center text-[0.65rem] text-amber-700/60">
            Loading routes…
          </p>
        ) : (
          <ul className="space-y-0.5">
            {entries.map((entry) => {
              const checked = visibleIds.has(entry.routeId);
              const active = entry.routeId === activeRouteId;
              return (
                <li key={entry.key}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 ${
                      active ? "bg-amber-900/35" : "hover:bg-amber-950/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-amber-500"
                      checked={checked}
                      onChange={() => onToggle(entry.routeId)}
                    />
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.routeColor }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-[0.7rem] text-amber-200/90"
                      onClick={(e) => {
                        e.preventDefault();
                        onActivate(entry);
                      }}
                      title="Set as active line (stations + highlight)"
                    >
                      {scope === "all" && (
                        <span className="mr-1 text-amber-700/80">
                          {entry.modeLabel} ·
                        </span>
                      )}
                      {entryTitle(entry)}
                    </button>
                    {active && (
                      <span className="led-text shrink-0 text-[0.45rem] uppercase tracking-wider text-emerald-500/80">
                        Active
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-amber-900/30 px-2 py-1 text-[0.55rem] text-amber-700/70">
        {visibleCount} visible · tap name to make active
      </div>
    </div>
  );
}
