# GreenLight Arrival Board (MBTA)

Production-quality **Next.js 15** (App Router) kiosk for MBTA **live arrivals** and **trip planning**. Defaults to Green Line D · Newton Highlands. Built for landscape tablets running **Fully Kiosk Browser**.

Live data uses the **MBTA V3 Server-Sent Events (SSE)** API. Trip search uses V3 schedules (direct same-trip OD). Weather uses [Open-Meteo](https://open-meteo.com/). Deploy on **Vercel**.

---

## Features

- **Modes:** Subway · Commuter Rail · Bus · Amtrak (info / external links only)
- **Live board:** Selectable route, station, and direction with SSE predictions + schedule fill-in
- **Trip planner** (`/plan`): Origin, destination, date, depart-after / arrive-by → direct trips + estimated fares
- Countdown + clock time, delay badges, walk-time leave / miss banners
- Service frequency, weather, optional chime/TTS announcements and webhook alerts
- PIN-protected `/settings`
- Approximate adult one-way fares (curated published rates; not an official fare API)

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

### 3. Run locally

```bash
npm run dev
```

- Board: [http://localhost:3000](http://localhost:3000)
- Trip planner: [http://localhost:3000/plan](http://localhost:3000/plan)
- Settings: [http://localhost:3000/settings](http://localhost:3000/settings) (PIN **`1234`**)

### 4. Production build

```bash
npm run build
npm start
```

---

## Modes & Amtrak

| Mode | Live board | Trip planner | Fares |
| --- | --- | --- | --- |
| Subway | Yes (SSE) | Direct same-trip | Flat ~$2.40 |
| Commuter Rail | Yes | Direct same-trip | Zone matrix (approx.) |
| Bus | Yes | Direct same-trip | Local / express (approx.) |
| Amtrak | Info panel only | Links to Amtrak.com | Not available |

Amtrak has **no reliable public trip/fare API**. The Amtrak tab explains this and links to official booking.

Trip search returns **direct same-vehicle** services only. For transfers, use the official [MBTA Trip Planner](https://www.mbta.com/trip-planner).

---

## Fares

Fares are **curated constants** from published MBTA rates (`src/lib/fares`), last verified in code comments. They are approximate adult one-way estimates—always confirm on [mbta.com/fares](https://www.mbta.com/fares). Commuter Rail uses a station→zone map that may not cover every stop.

---

## Architecture

```
src/
  app/                 # /, /plan, /settings, /api/trips/search
  components/          # Board, planner, chrome, Amtrak panel, …
  hooks/               # SSE, schedules, walk, weather, settings
  lib/
    mbta/              # parse, catalog, schedules, tripSearch, stations
    fares/             # curated fare tables
    providers/         # mode / catalog contracts
    walk.ts, weather.ts, settings.ts, audio/, alerts/
```

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

Transit data © MBTA via the V3 API. Weather via Open-Meteo (CC BY 4.0). This project is unofficial and not affiliated with the MBTA or Amtrak.
