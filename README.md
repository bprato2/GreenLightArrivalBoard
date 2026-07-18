# Newton Highlands Green Line D Arrival Board

Production-quality **Next.js 15** (App Router) kiosk display that recreates an MBTA **LED arrival sign** for **Newton Highlands** (`place-newtn`) on the Green Line D branch. Built for an 11″ landscape Samsung Galaxy Tab A9+ running **Fully Kiosk Browser**.

Live data comes from the **MBTA V3 Server-Sent Events (SSE)** API — no polling, no database, and no custom backend. Weather uses [Open-Meteo](https://open-meteo.com/) (no API key). Deploy as a static frontend on **Vercel**.

---

## Features

- Full-screen black / amber LED aesthetic with glow, scanlines, and restrained Framer Motion
- Live **inbound** Green Line D predictions + vehicle positions via dual SSE streams
- Countdown in minutes, delay / approaching badges, and “Currently at …” location labels
- Bottom **~20% mini-map** of the D branch with glowing train dots
- **Arrival alert** phases: pulse (default 3–7 min) → solid green (≤ 2 min), with a pluggable webhook adapter for Home Assistant / ESPHome
- Optional **Web Audio** two-tone chime + **SpeechSynthesis** announcements (once per train)
- Password-protected `/settings` (PIN in `localStorage`) for toggles, timings, glow, and tests
- Lightweight weather widget (temperature + simple icon)

---

## Quick start

### 1. Prerequisites

- Node.js 20+
- Free MBTA V3 API key from [MBTA Developers](https://api-v3.mbta.com/) (streaming **requires** a key)

### 2. Install & configure

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_MBTA_API_KEY=your_key_here
```

> The key is prefixed with `NEXT_PUBLIC_` because the browser opens EventSource connections **directly** to `api-v3.mbta.com` (no server proxy). Treat it as a kiosk credential: create a dedicated key, enable only what you need, and rotate if it leaks.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Settings: [http://localhost:3000/settings](http://localhost:3000/settings) (default PIN **`1234`**).

### 4. Production build

```bash
npm run build
npm start
```

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add environment variable:
   - `NEXT_PUBLIC_MBTA_API_KEY` = your MBTA key
4. Deploy.

No serverless functions, databases, or auth providers are required. The app is a client-rendered board that talks to MBTA + Open-Meteo from the tablet.

---

## MBTA API configuration

| Concern | Value |
| --- | --- |
| Stop | `place-newtn` (Newton Highlands) |
| Route | `Green-D` |
| Direction | `1` (inbound toward Government Center / downtown) |
| Streams | `/predictions` (stop + route + direction) and `/vehicles` (route) |
| Protocol | SSE with `Accept: text/event-stream`; events: `reset`, `add`, `update`, `remove` |

Implementation lives in:

- `src/hooks/useMbtaStream.ts` — dual EventSource, 2-hour forced reconnect, 1 Hz derived UI state
- `src/lib/mbta/parse.ts` — JSON:API merge + arrival / map derivation
- `src/lib/mbta/stations.ts` — D-branch station order and IDs

The board filters to **inbound** arrivals only and sorts by ETA. Vehicle `current_status` + stop relationships drive location text and mini-map positions.

---

## Fully Kiosk Browser (Galaxy Tab A9+)

Recommended settings for months of continuous wall display:

1. Install **Fully Kiosk Browser** (Plus license recommended for kiosk lockdown).
2. Start URL: your Vercel URL (e.g. `https://your-app.vercel.app`).
3. Enable **Fullscreen mode** / hide system UI.
4. Orientation: **Landscape**.
5. **Keep screen on** while charging; disable screen timeout.
6. Disable pull-to-refresh / swipe navigation if they steal gestures.
7. Optional: schedule a daily page reload (e.g. 03:30) as a safety net — the app also reconnects SSE every 2 hours.
8. Grant **microphone** only if you enable spoken announcements (SpeechSynthesis may not need it; Web Audio needs a user gesture once — tap the screen after load, or use Fully’s “enable autoplay”).
9. For audio autoplay: Fully → settings → enable autoplay for media / unmute WebView.
10. Camera / motion unused — leave disabled.

Camera-facing tip for glow: keep brightness moderate; LED CSS glow is adjustable under **Settings → LED glow intensity**.

---

## Settings (`/settings`)

Protected by a local PIN (default `1234`, changeable). Stored in `localStorage` under `greenlight-board-settings`:

| Setting | Purpose |
| --- | --- |
| Announcements | Chime + speech when a train enters the imminent window |
| Weather | Upper-right Open-Meteo widget |
| Mini-map | Bottom D-branch map |
| Alert timing | Pulse window + solid “imminent” threshold |
| LED glow | Text-shadow intensity |
| Webhook URL | Optional POST target for alert phase changes |
| Test announcement / Test alert | Manual QA without waiting for a train |

---

## Arrival alerts & smart beacons

Phases:

| Phase | Default condition | UI |
| --- | --- | --- |
| `idle` | Outside windows / no train | Dim indicator |
| `pulse` | 3–7 minutes away | Pulsing green |
| `imminent` | ≤ 2 minutes away | Solid green |

Adapters live in `src/lib/alerts/beacon.ts`:

- `NullAlertAdapter` — visual only (default)
- `WebhookAlertAdapter` — `POST` JSON to your URL on **phase change**

Example payload:

```json
{
  "phase": "pulse",
  "minutesAway": 5,
  "at": "2026-07-14T21:00:00.000Z",
  "stationId": "place-newtn",
  "stationName": "Newton Highlands",
  "source": "greenlight-arrival-board"
}
```

Wire the URL to a Home Assistant webhook automation, ESPHome HTTP trigger, or n8n without changing board components — only the adapter interface needs to stay stable.

---

## Architecture

```
src/
  app/                  # App Router pages (/, /settings)
  components/           # ArrivalBoard, ArrivalRow, MiniMap, Weather, …
  hooks/                # useMbtaStream, useSettings, useArrivalAlert, …
  lib/
    mbta/               # types, stations, SSE parse/derive
    audio/              # Web Audio chime + SpeechSynthesis
    alerts/             # Beacon / webhook adapters
    weather.ts          # Open-Meteo client
    settings.ts         # localStorage persistence
  types/                # BoardSettings
```

**Performance choices for 24/7 tablets**

- SSE instead of polling
- In-memory Maps for predictions/vehicles; React state updated on a **1 Hz** tick (not every GPS update)
- Periodic EventSource reconnect to avoid silent half-dead streams
- Minimal Framer Motion (row enter + train position springs only)
- CSS for scanlines / glow / pulses (no canvas)
- Weather refresh every 10 minutes

---

## Announcements

When enabled, a train whose ETA is ≤ 2 minutes is announced **once**:

1. Synthetic MBTA-style two-tone chime (`src/lib/audio/chime.ts`, Web Audio API — no files)
2. Spoken line via `SpeechSynthesis`:  
   _“The next inbound Green Line D train to Government Center is arriving.”_

Each prediction `id` is tracked until it leaves the board.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |

---

## License / attribution

Transit data © MBTA via the V3 API. Weather via Open-Meteo (CC BY 4.0). This project is unofficial and not affiliated with the MBTA.
