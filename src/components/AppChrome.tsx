"use client";

import Link from "next/link";
import { TRANSIT_MODES, type TransitMode } from "@/lib/providers/types";
import type { AppView } from "@/lib/providers/types";

interface AppChromeProps {
  mode: TransitMode;
  appView: AppView;
  onModeChange: (mode: TransitMode) => void;
  /** When provided, use client navigation instead of links for view. */
  onViewChange?: (view: AppView) => void;
}

/** Top chrome: Board | Plan toggle + transit mode tabs. */
export function AppChrome({
  mode,
  appView,
  onModeChange,
  onViewChange,
}: AppChromeProps) {
  const tabClass = (active: boolean) =>
    `led-text rounded px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.18em] transition-colors ${
      active
        ? "bg-amber-700/40 text-amber-200"
        : "text-amber-800/80 hover:text-amber-500"
    }`;

  return (
    <div className="relative z-40 flex shrink-0 flex-col gap-2 border-b border-amber-900/40 bg-black/90 px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {onViewChange ? (
            <>
              <button
                type="button"
                className={tabClass(appView === "board")}
                onClick={() => onViewChange("board")}
              >
                Board
              </button>
              <button
                type="button"
                className={tabClass(appView === "plan")}
                onClick={() => onViewChange("plan")}
              >
                Plan
              </button>
            </>
          ) : (
            <>
              <Link href="/" className={tabClass(appView === "board")}>
                Board
              </Link>
              <Link href="/plan" className={tabClass(appView === "plan")}>
                Plan
              </Link>
            </>
          )}
        </div>
        <span className="led-text text-[0.55rem] uppercase tracking-[0.25em] text-amber-700/70">
          MBTA
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {TRANSIT_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={tabClass(mode === m.id)}
            onClick={() => onModeChange(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
