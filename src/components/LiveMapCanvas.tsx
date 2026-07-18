"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LiveVehicle } from "@/hooks/useRouteVehicles";
import type { LatLon, RoutePolyline } from "@/lib/mbta/shapes";
import type { StationInfo } from "@/lib/mbta/stations";

export interface LiveMapCanvasProps {
  lines: RoutePolyline[];
  /** Route ids that should be drawn highlighted. */
  highlightIds: Set<string>;
  vehicles: LiveVehicle[];
  /** Fallback color when a vehicle has no route color. */
  vehicleColor: string;
  /** Per-route colors for multi-line vehicle markers. */
  routeColors?: Record<string, string>;
  /** Stations that are clickable (usually selected route). */
  stations: StationInfo[];
  selectedStopId?: string;
  onSelectStation: (station: StationInfo) => void;
  /** Click another line on the map to select it. */
  onSelectRoute: (routeId: string, color: string) => void;
  glow?: number;
}

interface LabelBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function segmentLatLngs(points: LatLon[]): L.LatLngExpression[][] {
  const segs: L.LatLngExpression[][] = [];
  let cur: L.LatLngExpression[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) {
      if (cur.length >= 2) segs.push(cur);
      cur = [];
      continue;
    }
    cur.push([p.lat, p.lon]);
  }
  if (cur.length >= 2) segs.push(cur);
  return segs;
}

function boundsFromLines(lines: RoutePolyline[]): L.LatLngBounds | null {
  const b = L.latLngBounds([]);
  let any = false;
  for (const line of lines) {
    for (const p of line.points) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
      b.extend([p.lat, p.lon]);
      any = true;
    }
  }
  return any ? b : null;
}

function overlaps(a: LabelBox, b: LabelBox, pad: number): boolean {
  return !(
    a.right + pad < b.left ||
    a.left - pad > b.right ||
    a.bottom + pad < b.top ||
    a.top - pad > b.bottom
  );
}

function estimateLabelBox(
  x: number,
  y: number,
  text: string,
): LabelBox {
  // Approximate chip size under the station dot.
  const w = Math.min(160, Math.max(48, text.length * 7.2 + 16));
  const h = 18;
  const left = x - w / 2;
  const top = y + 8;
  return { left, top, right: left + w, bottom: top + h };
}

function shortLabel(name: string, zoom: number): string {
  const cleaned = name.replace(/\s+Station$/i, "").trim();
  if (zoom >= 14) return cleaned;
  if (cleaned.length <= 14) return cleaned;
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    const two = `${parts[0]} ${parts[1]}`;
    if (two.length <= 16) return two;
  }
  return `${cleaned.slice(0, 12)}…`;
}

/**
 * Pick which stations get visible name chips so labels don't stack when zoomed out.
 */
function pickLabeledStationIds(
  map: L.Map,
  stations: StationInfo[],
  selectedStopId: string | undefined,
): Set<string> {
  const zoom = map.getZoom();
  const labeled = new Set<string>();
  if (stations.length === 0) return labeled;

  // Always show selected stop name.
  if (selectedStopId) labeled.add(selectedStopId);

  // Very zoomed out: dots only (+ selected).
  if (zoom < 11) return labeled;

  const termini = new Set<string>();
  const first = stations[0]?.id;
  const last = stations[stations.length - 1]?.id;
  if (first) termini.add(first);
  if (last) termini.add(last);

  // Priority: selected → termini → remaining in order.
  const ordered = [...stations].sort((a, b) => {
    const score = (s: StationInfo) => {
      if (s.id === selectedStopId) return 0;
      if (termini.has(s.id)) return 1;
      return 2;
    };
    return score(a) - score(b);
  });

  // Allow denser labels as you zoom in.
  const maxLabels =
    zoom >= 15
      ? stations.length
      : zoom >= 14
        ? Math.max(8, Math.ceil(stations.length * 0.85))
        : zoom >= 13
          ? Math.max(6, Math.ceil(stations.length * 0.55))
          : zoom >= 12
            ? Math.max(4, Math.ceil(stations.length * 0.35))
            : Math.max(2, Math.ceil(stations.length * 0.2));

  const placed: LabelBox[] = [];
  const pad = zoom >= 14 ? 4 : zoom >= 12 ? 10 : 16;

  for (const station of ordered) {
    if (labeled.size >= maxLabels && station.id !== selectedStopId) break;
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lon)) continue;

    const pt = map.latLngToContainerPoint([station.lat, station.lon]);
    const text = shortLabel(station.name, zoom);
    const box = estimateLabelBox(pt.x, pt.y, text);

    const hit = placed.some((p) => overlaps(p, box, pad));
    if (hit && station.id !== selectedStopId) continue;

    labeled.add(station.id);
    placed.push(box);
  }

  return labeled;
}

function stationIcon(
  name: string,
  selected: boolean,
  showLabel: boolean,
  zoom: number,
): L.DivIcon {
  const safe = shortLabel(name, zoom).replace(/</g, "&lt;");
  const label = showLabel
    ? `<span class="map-station-label">${safe}</span>`
    : "";
  return L.divIcon({
    className: "map-station-marker",
    html: `<div class="map-station ${selected ? "is-selected" : ""} ${showLabel ? "has-label" : ""}">
      <span class="map-station-dot" aria-hidden="true"></span>
      ${label}
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function routeDisplayName(routeId: string): string {
  if (routeId.startsWith("Green-")) {
    return `Green Line ${routeId.replace("Green-", "")}`;
  }
  if (routeId === "Mattapan") return "Mattapan Line";
  if (routeId === "Red" || routeId === "Orange" || routeId === "Blue") {
    return `${routeId} Line`;
  }
  return routeId;
}

/** Train icon with travel direction (arrow + IN/OUT badge). */
function vehicleIcon(
  color: string,
  label: string | null,
  bearing: number | null,
  directionId: number,
): L.DivIcon {
  const inbound = directionId === 1;
  const dirWord = inbound ? "Inbound" : "Outbound";
  const dirShort = inbound ? "IN" : "OUT";
  const title = label ? `Train ${label} · ${dirWord}` : `Train · ${dirWord}`;
  const rot = Number.isFinite(bearing) ? bearing! : inbound ? 90 : 270;
  const safeTitle = title.replace(/"/g, "&quot;");
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : "#f59e0b";
  return L.divIcon({
    className: "map-vehicle-marker",
    html: `<div class="map-vehicle" style="--veh:${safeColor}" title="${safeTitle}">
      <div class="map-vehicle-badge ${inbound ? "is-in" : "is-out"}">${dirShort}</div>
      <svg class="map-vehicle-svg" viewBox="0 0 32 40" width="32" height="40" aria-hidden="true" style="transform:rotate(${rot}deg)">
        <path d="M16 1 L24 11 H8 Z" fill="#ffffff" stroke="#0a0a0a" stroke-width="0.8"/>
        <rect x="8" y="11" width="16" height="20" rx="3.5" fill="${safeColor}" stroke="#ffffff" stroke-width="1.6"/>
        <rect x="10.5" y="14" width="4.5" height="4" rx="0.8" fill="#0a0a0a" opacity="0.55"/>
        <rect x="17" y="14" width="4.5" height="4" rx="0.8" fill="#0a0a0a" opacity="0.55"/>
        <rect x="10.5" y="20.5" width="11" height="2.2" rx="0.6" fill="#ffffff" opacity="0.4"/>
        <circle cx="12" cy="28.5" r="1.6" fill="#0a0a0a" opacity="0.75"/>
        <circle cx="20" cy="28.5" r="1.6" fill="#0a0a0a" opacity="0.75"/>
        <path d="M11 33 H21 L16 38 Z" fill="#ffffff" opacity="0.85"/>
      </svg>
    </div>`,
    iconSize: [32, 48],
    iconAnchor: [16, 24],
  });
}

/**
 * Geographic Leaflet map: dark basemap, pan/zoom, clickable lines & stations.
 */
export function LiveMapCanvas({
  lines,
  highlightIds,
  vehicles,
  vehicleColor,
  routeColors = {},
  stations,
  selectedStopId,
  onSelectStation,
  onSelectRoute,
}: LiveMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const linesLayerRef = useRef<L.LayerGroup | null>(null);
  const stationsLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const fitKeyRef = useRef<string>("");
  const [mapReady, setMapReady] = useState(false);

  const onSelectStationRef = useRef(onSelectStation);
  onSelectStationRef.current = onSelectStation;
  const onSelectRouteRef = useRef(onSelectRoute);
  onSelectRouteRef.current = onSelectRoute;

  // Init map once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
      // HTML DivIcons (trains/stations) need the SVG/HTML overlay pane — not canvas-only.
      preferCanvas: false,
    }).setView([42.36, -71.06], 12);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    linesLayerRef.current = L.layerGroup().addTo(map);
    stationsLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setMapReady(true);

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(el);
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      ro.disconnect();
      setMapReady(false);
      map.remove();
      mapRef.current = null;
      linesLayerRef.current = null;
      stationsLayerRef.current = null;
      vehiclesLayerRef.current = null;
      vehicleMarkersRef.current.clear();
    };
  }, []);

  // Draw route polylines (clickable to select).
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const layer = linesLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const drawLine = (line: RoutePolyline, highlighted: boolean) => {
      const segs = segmentLatLngs(line.points);
      for (const latlngs of segs) {
        const poly = L.polyline(latlngs, {
          color: line.color,
          weight: highlighted ? 7 : 4,
          opacity: highlighted ? 0.95 : 0.45,
          lineCap: "round",
          lineJoin: "round",
          interactive: true,
          className: highlighted ? "map-line-selected" : "map-line-muted",
        });
        poly.on("click", (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          if (!highlighted) {
            onSelectRouteRef.current(line.routeId, line.color);
          }
        });
        const name = routeDisplayName(line.routeId);
        poly.bindTooltip(
          highlighted ? `${name} (selected)` : `Select ${name}`,
          { sticky: true, direction: "top", opacity: 0.9 },
        );
        if (!highlighted) {
          const hit = L.polyline(latlngs, {
            color: "#000",
            weight: 18,
            opacity: 0,
            interactive: true,
          });
          hit.on("click", (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e);
            onSelectRouteRef.current(line.routeId, line.color);
          });
          layer.addLayer(hit);
        }
        layer.addLayer(poly);
      }
    };

    for (const line of lines) {
      if (!highlightIds.has(line.routeId)) drawLine(line, false);
    }
    for (const line of lines) {
      if (highlightIds.has(line.routeId)) drawLine(line, true);
    }

    const fitKey =
      [...highlightIds].sort().join(",") ||
      lines.map((l) => l.routeId).join(",");
    const focusLines = lines.filter((l) => highlightIds.has(l.routeId));
    const fitSource = focusLines.length > 0 ? focusLines : lines;
    const bounds = boundsFromLines(fitSource);
    if (bounds && fitKey !== fitKeyRef.current) {
      fitKeyRef.current = fitKey;
      map.fitBounds(bounds.pad(0.12), { animate: true, maxZoom: 14 });
    }
  }, [lines, highlightIds, mapReady]);

  // Station markers with collision-aware labels.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const layer = stationsLayerRef.current;
    if (!map || !layer) return;

    const redraw = () => {
      layer.clearLayers();
      const zoom = map.getZoom();
      const labeledIds = pickLabeledStationIds(map, stations, selectedStopId);

      for (const station of stations) {
        if (!Number.isFinite(station.lat) || !Number.isFinite(station.lon)) {
          continue;
        }
        const selected = station.id === selectedStopId;
        const showLabel = labeledIds.has(station.id);
        const marker = L.marker([station.lat, station.lon], {
          icon: stationIcon(station.name, selected, showLabel, zoom),
          interactive: true,
          keyboard: true,
          title: `${station.name} — open board`,
          zIndexOffset: selected ? 600 : 400,
        });
        marker.on("click", (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          onSelectStationRef.current(station);
        });
        layer.addLayer(marker);
      }
    };

    redraw();
    map.on("zoomend", redraw);
    map.on("moveend", redraw);
    return () => {
      map.off("zoomend", redraw);
      map.off("moveend", redraw);
    };
  }, [stations, selectedStopId, mapReady]);

  // Live vehicles — re-sync whenever data OR map readiness changes.
  useEffect(() => {
    if (!mapReady) return;
    const layer = vehiclesLayerRef.current;
    if (!layer) return;

    const sync = (list: LiveVehicle[], fallback: string) => {
      const seen = new Set<string>();
      for (const v of list) {
        if (!Number.isFinite(v.lat) || !Number.isFinite(v.lon)) continue;
        seen.add(v.id);
        const color =
          (v.routeId && routeColors[v.routeId]) || fallback;
        const existing = vehicleMarkersRef.current.get(v.id);
        const icon = vehicleIcon(color, v.label, v.bearing, v.directionId);
        if (existing) {
          existing.setLatLng([v.lat, v.lon]);
          existing.setIcon(icon);
        } else {
          const marker = L.marker([v.lat, v.lon], {
            icon,
            interactive: true,
            keyboard: false,
            zIndexOffset: 900,
            title: v.label
              ? `Train ${v.label} · ${v.directionId === 1 ? "Inbound" : "Outbound"}`
              : v.directionId === 1
                ? "Train · Inbound"
                : "Train · Outbound",
          });
          layer.addLayer(marker);
          vehicleMarkersRef.current.set(v.id, marker);
        }
      }

      for (const [id, marker] of vehicleMarkersRef.current) {
        if (seen.has(id)) continue;
        layer.removeLayer(marker);
        vehicleMarkersRef.current.delete(id);
      }
    };

    sync(vehicles, vehicleColor);
  }, [vehicles, vehicleColor, routeColors, mapReady]);

  return (
    <div
      ref={containerRef}
      className="live-map-root h-full w-full rounded border border-amber-900/40"
      role="application"
      aria-label="Live transit map"
    />
  );
}
