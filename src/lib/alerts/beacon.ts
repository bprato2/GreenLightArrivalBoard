/**
 * Pluggable arrival-alert adapters.
 *
 * Visual indicator is always driven by the board; adapters receive state changes
 * so a Home Assistant webhook, ESPHome beacon, or MQTT bridge can be wired later
 * without rewriting board UI code.
 */

export type ArrivalAlertPhase = "idle" | "pulse" | "imminent";

export interface ArrivalAlertPayload {
  phase: ArrivalAlertPhase;
  /** Whole minutes until the closest inbound train (null when idle / no trains). */
  minutesAway: number | null;
  /** Wall-clock ISO timestamp of the event. */
  at: string;
  stationId: string;
  stationName: string;
}

export interface ArrivalAlertAdapter {
  /** Called when the derived phase changes (or on significant ETA tick if desired). */
  onPhaseChange(payload: ArrivalAlertPayload): void | Promise<void>;
}

/** No-op default — board still shows the visual indicator. */
export class NullAlertAdapter implements ArrivalAlertAdapter {
  onPhaseChange(): void {
    /* intentional no-op */
  }
}

/**
 * POSTs JSON payloads to an optional webhook (Home Assistant automation,
 * ESPHome native API bridge via webhook, n8n, etc.).
 *
 * Failures are swallowed so a flaky beacon never crashes the kiosk UI.
 */
export class WebhookAlertAdapter implements ArrivalAlertAdapter {
  constructor(private readonly url: string) {}

  async onPhaseChange(payload: ArrivalAlertPayload): Promise<void> {
    if (!this.url) return;
    try {
      await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          source: "greenlight-arrival-board",
        }),
        keepalive: true,
      });
    } catch {
      // Kiosk must keep running even if the webhook is unreachable.
    }
  }
}

export function createAlertAdapter(webhookUrl: string): ArrivalAlertAdapter {
  const trimmed = webhookUrl.trim();
  if (!trimmed) return new NullAlertAdapter();
  return new WebhookAlertAdapter(trimmed);
}
