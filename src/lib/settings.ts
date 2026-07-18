import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type BoardSettings,
} from "@/types/settings";
import { coerceDirection } from "@/lib/mbta/boardConfig";
import { isAppView, isTransitMode } from "@/lib/providers/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function loadSettings(): BoardSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { ...DEFAULT_SETTINGS };
    return {
      ...DEFAULT_SETTINGS,
      ...sanitizeSettings(parsed),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function hasStoredSettings(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SETTINGS_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveSettings(settings: BoardSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function sanitizeSettings(partial: Record<string, unknown>): Partial<BoardSettings> {
  const next: Partial<BoardSettings> = {};

  if (typeof partial.announcementsEnabled === "boolean") {
    next.announcementsEnabled = partial.announcementsEnabled;
  }
  if (typeof partial.weatherEnabled === "boolean") {
    next.weatherEnabled = partial.weatherEnabled;
  }
  if (typeof partial.miniMapEnabled === "boolean") {
    next.miniMapEnabled = partial.miniMapEnabled;
  }
  if (typeof partial.alertPulseMaxMinutes === "number") {
    next.alertPulseMaxMinutes = clamp(partial.alertPulseMaxMinutes, 2, 20);
  }
  if (typeof partial.alertPulseMinMinutes === "number") {
    next.alertPulseMinMinutes = clamp(partial.alertPulseMinMinutes, 1, 15);
  }
  if (typeof partial.alertImminentMinutes === "number") {
    next.alertImminentMinutes = clamp(partial.alertImminentMinutes, 0, 5);
  }
  if (typeof partial.ledGlowIntensity === "number") {
    next.ledGlowIntensity = clamp(partial.ledGlowIntensity, 0, 1);
  }
  if (typeof partial.alertWebhookUrl === "string") {
    next.alertWebhookUrl = partial.alertWebhookUrl.slice(0, 500);
  }
  if (typeof partial.settingsPin === "string" && /^\d{4,8}$/.test(partial.settingsPin)) {
    next.settingsPin = partial.settingsPin;
  }
  if (isTransitMode(partial.mode)) {
    next.mode = partial.mode;
  }
  if (typeof partial.routeId === "string" && partial.routeId) {
    next.routeId = partial.routeId;
  }
  if (typeof partial.stopId === "string" && partial.stopId) {
    next.stopId = partial.stopId;
  }
  if (typeof partial.stopName === "string") {
    next.stopName = partial.stopName.slice(0, 120);
  }
  if (typeof partial.stopLat === "number" && Number.isFinite(partial.stopLat)) {
    next.stopLat = partial.stopLat;
  }
  if (typeof partial.stopLon === "number" && Number.isFinite(partial.stopLon)) {
    next.stopLon = partial.stopLon;
  }
  if (typeof partial.directionId === "number") {
    next.directionId = coerceDirection(partial.directionId);
  }
  if (isAppView(partial.appView)) {
    next.appView = partial.appView;
  }
  if (typeof partial.routeColor === "string" && /^#[0-9a-fA-F]{6}$/.test(partial.routeColor)) {
    next.routeColor = partial.routeColor;
  }

  return next;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
