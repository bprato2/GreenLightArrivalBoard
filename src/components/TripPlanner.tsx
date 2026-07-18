"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatFareAmount, type FareEstimate } from "@/lib/fares";
import { fetchRoutesForMode, searchStops } from "@/lib/mbta/catalog";
import type { TransitMode, TransitRoute, TransitStop } from "@/lib/providers/types";
import { AmtrakPanel } from "@/components/AmtrakPanel";

interface TripResult {
  tripId: string;
  routeId: string;
  routeName: string;
  routeColor: string;
  headsign: string;
  departAt: string;
  arriveAt: string;
  durationMinutes: number;
  fare: FareEstimate;
}

interface TripPlannerProps {
  mode: TransitMode;
  defaultRouteId?: string;
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  }).format(new Date(iso));
}

function StopSearchField({
  label,
  value,
  displayName,
  mode,
  onSelect,
}: {
  label: string;
  value: string;
  displayName: string;
  mode: TransitMode;
  onSelect: (stop: TransitStop) => void;
}) {
  const [query, setQuery] = useState(displayName);
  const [results, setResults] = useState<TransitStop[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(displayName);
  }, [displayName]);

  useEffect(() => {
    if (query.trim().length < 2 || query === displayName) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void searchStops(query, mode).then((list) => {
        if (!cancelled) setResults(list);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, mode, displayName]);

  return (
    <label className="relative flex flex-col gap-1 text-sm">
      <span className="text-amber-500">{label}</span>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Type a station name…"
        className="rounded border border-zinc-700 bg-black px-3 py-2 text-amber-100 outline-none focus:border-amber-600"
      />
      {value && (
        <span className="text-[0.65rem] text-zinc-500">Selected: {value}</span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute top-full z-50 mt-1 max-h-48 w-full overflow-auto rounded border border-zinc-700 bg-zinc-950 shadow-lg">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-amber-100 hover:bg-amber-950/50"
                onClick={() => {
                  onSelect(s);
                  setQuery(s.name);
                  setOpen(false);
                }}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}

export function TripPlanner({ mode, defaultRouteId }: TripPlannerProps) {
  const [origin, setOrigin] = useState<TransitStop | null>(null);
  const [destination, setDestination] = useState<TransitStop | null>(null);
  const [date, setDate] = useState(todayLocal);
  const [time, setTime] = useState("08:00");
  const [preference, setPreference] = useState<"depart_after" | "arrive_by">(
    "depart_after",
  );
  const [routeId, setRouteId] = useState(defaultRouteId ?? "");
  const [routes, setRoutes] = useState<TransitRoute[]>([]);
  const [trips, setTrips] = useState<TripResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(null);
    setDestination(null);
    setTrips([]);
    setError(null);
    if (mode === "amtrak") return;
    void fetchRoutesForMode(mode).then((list) => {
      setRoutes(list);
      setRouteId(defaultRouteId && list.some((r) => r.id === defaultRouteId) ? defaultRouteId : "");
    });
  }, [mode, defaultRouteId]);

  const canSearch = useMemo(
    () =>
      mode !== "amtrak" &&
      Boolean(origin?.id) &&
      Boolean(destination?.id) &&
      origin?.id !== destination?.id,
    [mode, origin, destination],
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSearch || !origin || !destination) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        mode,
        origin: origin.id,
        destination: destination.id,
        date,
        time,
        preference,
      });
      if (routeId) params.set("route", routeId);
      const res = await fetch(`/api/trips/search?${params}`);
      const body = (await res.json()) as {
        trips?: TripResult[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      setTrips(body.trips ?? []);
      if ((body.trips ?? []).length === 0) {
        setError(
          "No direct same-trip services found. Try another time, or use the official MBTA Trip Planner for transfers.",
        );
      }
    } catch (err) {
      setTrips([]);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  if (mode === "amtrak") {
    return <AmtrakPanel />;
  }

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6 text-amber-100"
      data-allow-scroll="true"
    >
      <div>
        <h1 className="text-xl font-semibold tracking-wide text-amber-300">
          Trip planner
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Direct same-trip schedules for the selected mode. Multi-transfer journeys:{" "}
          <a
            href="https://www.mbta.com/trip-planner"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-500 hover:text-amber-300"
          >
            MBTA Trip Planner
          </a>
          .
        </p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-3">
        <StopSearchField
          label="Origin"
          value={origin?.id ?? ""}
          displayName={origin?.name ?? ""}
          mode={mode}
          onSelect={setOrigin}
        />
        <StopSearchField
          label="Destination"
          value={destination?.id ?? ""}
          displayName={destination?.name ?? ""}
          mode={mode}
          onSelect={setDestination}
        />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-amber-500">Route (optional)</span>
          <select
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            className="rounded border border-zinc-700 bg-black px-3 py-2 outline-none focus:border-amber-600"
          >
            <option value="">Any route in mode</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.shortName ? `${r.shortName} · ${r.label}` : r.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-amber-500">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border border-zinc-700 bg-black px-3 py-2 outline-none focus:border-amber-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-amber-500">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded border border-zinc-700 bg-black px-3 py-2 outline-none focus:border-amber-600"
            />
          </label>
        </div>

        <fieldset className="flex gap-4 text-sm">
          <legend className="sr-only">Time preference</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={preference === "depart_after"}
              onChange={() => setPreference("depart_after")}
            />
            Depart after
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={preference === "arrive_by"}
              onChange={() => setPreference("arrive_by")}
            />
            Arrive by
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={!canSearch || loading}
          className="rounded bg-amber-600/40 py-3 font-medium text-amber-50 hover:bg-amber-600/60 disabled:opacity-40"
        >
          {loading ? "Searching…" : "Find trips"}
        </button>
      </form>

      {error && <p className="text-sm text-amber-500">{error}</p>}

      <ul className="flex flex-col gap-3">
        {trips.map((t) => (
          <li
            key={`${t.tripId}-${t.departAt}`}
            className="rounded-lg border border-amber-900/40 bg-black/60 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: t.routeColor }}
                    aria-hidden
                  />
                  <span className="font-medium text-amber-200">{t.routeName}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">{t.headsign}</p>
                <p className="mt-2 led-text text-amber-300">
                  {formatClock(t.departAt)} → {formatClock(t.arriveAt)}
                  <span className="ml-2 text-amber-700">
                    · {t.durationMinutes} min
                  </span>
                </p>
              </div>
              <div className="text-right text-sm">
                <div className="led-text text-lg text-emerald-400">
                  {formatFareAmount(t.fare.amountUsd)}
                </div>
                <div className="text-[0.7rem] text-zinc-500">{t.fare.fareType}</div>
                {t.fare.zoneInfo && (
                  <div className="text-[0.7rem] text-amber-600">{t.fare.zoneInfo}</div>
                )}
              </div>
            </div>
            <p className="mt-2 text-[0.65rem] text-zinc-600">
              {t.fare.notes}{" "}
              <a
                href={t.fare.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-700 hover:text-amber-500"
              >
                Official fares
              </a>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
