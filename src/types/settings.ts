/** Persisted board preferences (localStorage). */

import type { DirectionId } from "@/lib/mbta/boardConfig";
import {
  DEFAULT_MODE,
  DEFAULT_ROUTE_ID,
  DEFAULT_STOP_ID,
} from "@/lib/mbta/boardConfig";
import type { AppView, TransitMode } from "@/lib/providers/types";

export interface BoardSettings {
  announcementsEnabled: boolean;
  weatherEnabled: boolean;
  miniMapEnabled: boolean;
  alertPulseMaxMinutes: number;
  alertPulseMinMinutes: number;
  alertImminentMinutes: number;
  ledGlowIntensity: number;
  alertWebhookUrl: string;
  settingsPin: string;
  /** Subway / CR / Bus / Amtrak. */
  mode: TransitMode;
  /** MBTA route id (e.g. Green-D, CR-Worcester, 1). */
  routeId: string;
  /** Selected stop / parent station id. */
  stopId: string;
  /** Display name for the selected stop (cached from catalog). */
  stopName: string;
  /** Cached stop coordinates for walk estimates. */
  stopLat: number;
  stopLon: number;
  /** 1 = inbound, 0 = outbound. */
  directionId: DirectionId;
  /** Primary chrome view. */
  appView: AppView;
  /** Cached route color (#rrggbb) for accents. */
  routeColor: string;
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
  mode: DEFAULT_MODE,
  routeId: DEFAULT_ROUTE_ID,
  stopId: DEFAULT_STOP_ID,
  stopName: "Newton Highlands",
  stopLat: 42.3222,
  stopLon: -71.2054,
  directionId: 1,
  appView: "board",
  routeColor: "#00843d",
};

export const SETTINGS_STORAGE_KEY = "greenlight-board-settings";
