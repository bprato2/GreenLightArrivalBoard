import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  type BoardSettings,
} from "@/types/settings";

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

  return next;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
