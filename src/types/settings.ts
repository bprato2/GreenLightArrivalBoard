/** Persisted board preferences (localStorage). */
export interface BoardSettings {
  /** Spoken arrival announcements via Web Audio + SpeechSynthesis. */
  announcementsEnabled: boolean;
  /** Upper-right weather widget. */
  weatherEnabled: boolean;
  /** Bottom Green Line D mini-map. */
  miniMapEnabled: boolean;
  /** Minutes away at which the green pulse starts (inclusive lower bound of window). */
  alertPulseMaxMinutes: number;
  /** Minutes away at which the green pulse starts (inclusive upper bound). Default 7. */
  alertPulseMinMinutes: number;
  /** Minutes away at which the solid green "imminent" state begins. Default 2. */
  alertImminentMinutes: number;
  /** LED text-shadow intensity, 0–1. */
  ledGlowIntensity: number;
  /** Optional webhook URL for Home Assistant / ESPHome / automation bridges. */
  alertWebhookUrl: string;
  /** Settings page PIN (local only). */
  settingsPin: string;
}

export const DEFAULT_SETTINGS: BoardSettings = {
  announcementsEnabled: false,
  weatherEnabled: true,
  miniMapEnabled: true,
  alertPulseMaxMinutes: 7,
  alertPulseMinMinutes: 3,
  alertImminentMinutes: 2,
  ledGlowIntensity: 0.65,
  alertWebhookUrl: "",
  settingsPin: "1234",
};

export const SETTINGS_STORAGE_KEY = "greenlight-board-settings";
