# All About F1

A full-stack Formula 1 companion app — live timing during a session, a statistically-driven Race Predictor with a model-evaluation history, a between-race Race Hub, plus drivers, teams, circuits, head-to-head comparisons, F1 news, an F1 glossary, and a personal profile.

## Key Features

- **Live Race Dashboard** — live timing, battles, tyre/strategy, race control, weather and team radio during an active session, sourced from F1's own public live timing feed
- **Race Hub** — a full between-race dashboard (team focus, last race summary/strategy, recent form, next-race context, championship snapshot, latest news) shown automatically whenever no session is live
- **Race Predictor** — a transparent, data-driven prediction for the next Grand Prix (predicted classification, win/podium/top-5/top-10 probabilities, and the model factors behind each prediction)
- **Prediction vs Reality** — model performance measured against actual results once predicted races complete (winner accuracy, podium/top-5/top-10 hit rate, positional error, per-driver evaluation)
- **Drivers & Constructors** — season rosters, detailed profiles, and head-to-head comparisons
- **Race Weekend** — session schedule, qualifying, sprint (when applicable), results and standings for any Grand Prix
- **F1 Dictionary** — a searchable glossary of F1 terms and concepts
- **News** — latest Formula 1 headlines
- **Auth & Profile** — sign up/log in, set a favorite driver and team, manage preferences

## Tech Stack

**Frontend** — React 19, React Router 7, Vite, Recharts (comparison charts), Lucide icons

**Backend** — Node.js, Express 5, MongoDB with Mongoose, JWT-based authentication, bcrypt, `ws` (F1 live timing WebSocket client)

**External data sources**
- [Jolpica (Ergast-compatible) F1 API](https://api.jolpi.ca) — schedules, results, qualifying, standings, pit stops, circuit history (historical/current-season data)
- F1's public live timing feed — real-time session data for the Live Race Dashboard (see below)
- [NewsAPI](https://newsapi.org) — latest F1 news articles

None of these are official/licensed F1 data products — see the architecture sections below for exactly what each one is and isn't.

## Architecture

```
Browser
   │
   ▼
React (Vite)  ──────────────────────────────►  Express API (Node.js)
                                                       │
                                    ┌──────────────────┼───────────────────┬─────────────┐
                                    ▼                  ▼                   ▼             ▼
                              Jolpica API      F1 Live Timing        NewsAPI       MongoDB
                              (schedules,         (SignalR,         (headlines)   (users,
                            results, standings,  live sessions)                  predictions)
                             pit stops, circuit
                                  history)
```

The frontend never talks to Jolpica, the live timing feed, or NewsAPI directly — everything goes through the Express backend, which normalizes each source into a stable response shape and keeps all credentials/connection details server-side.

### Race Predictor data flow

```
Historical + current-season F1 data (Jolpica)
        │
        ▼
Feature engineering (recent form, qualifying, constructor
strength, circuit history, championship standing)
        │
        ▼
Weighted power-ranking → Plackett-Luce Monte Carlo simulation
        │
        ▼
GET /api/predictor/upcoming  ──────►  Predictor UI
        │
        ▼
Persisted (RacePrediction, MongoDB)
        │
        ▼
Race happens → actual result (Jolpica)
        │
        ▼
Evaluation engine (driver-matched, leakage-safe)
        │
        ▼
GET /api/predictor/history · /performance · /evaluation/:season/:round
```

## Live Data Architecture

`GET /api/live/race` combines two providers behind one stable response shape:

- **Jolpica** — the season schedule, race results, qualifying, and standings. It has no genuine live/in-session data, so its schedule is used to estimate when a session *should* be happening.
- **F1 Live Timing** (`server/services/f1LiveTimingService.js`) — the same publicly reachable SignalR stream ([`wss://livetiming.formula1.com/signalrcore`](https://livetiming.formula1.com)) that F1's own broadcast graphics and the open-source [FastF1](https://github.com/theOehrly/Fast-F1) project consume, used here without any login or subscription. When it's actively tracking a session, live driver positions, gaps, lap/sector times, best laps, tyre stints, race control messages, team radio, and weather are preferred and `provider` is reported as `"f1-live-timing"`.

The backend keeps one long-lived connection to the live timing feed (opened once at startup, with automatic reconnect) rather than opening one per request; `liveRaceService.js` merges its state with the Jolpica schedule and normalizes it. No credentials are required or supported for this — when no session is live, the endpoint falls back to schedule-only data (and the frontend shows the full Race Hub) with `dataStatus: "unavailable"` instead of crashing.

**Important:** this is not an official, licensed F1 data source — it's a publicly accessible feed, consumed the same way FastF1 does, without authentication. Two channels that carry car telemetry and GPS (`CarData.z`, `Position.z`) are gated behind an F1TV subscription login that this project deliberately does not implement, so speed/throttle/brake/gear/DRS and on-track (x, y) position are not available here; those fields are always returned as `null` rather than faked. Availability of the free channels may change if F1 alters the feed.

## Race Predictor Architecture

`GET /api/predictor/upcoming` (`server/services/predictorService.js`) generates a statistical prediction for the next Grand Prix from real Jolpica data — no LLM, no fabricated numbers.

**Method — weighted power-ranking + Plackett-Luce simulation.** There isn't a training dataset here suitable for a real ML classifier (the grid, rules, and car performance change every season), so instead of forcing one, each driver gets a transparent 0–1 "strength" score built from five documented, weighted features:

| Feature | Weight | Source |
|---|---|---|
| Recent form | 0.35 | Last 5 races, recency-weighted (finish position, points, podiums) |
| Qualifying | 0.25 | This weekend's grid — only once qualifying has actually happened; its weight is redistributed across the other four beforehand, never guessed |
| Constructor strength | 0.20 | Current constructor standings position |
| Circuit history | 0.10 | Driver's all-time record at this specific circuit (neutral default for drivers with no prior starts there — never fabricated) |
| Championship standing | 0.10 | Current driver standings position |

Those strength scores feed a **Plackett-Luce Monte Carlo simulation** (5,000 simulated race orders) — the standard, explainable method for turning per-competitor strength into real finishing-order probabilities, rather than presenting a raw score as if it were a probability. Win/podium/top-5/top-10 probabilities and expected finish are the actual tallied simulation outcomes (win probabilities across the full field sum to 1.0).

**Leakage prevention:** every feature is scoped to data available *before* the race being predicted — standings reflect only completed races, recent form only looks at rounds strictly before the target round, and circuit history is always a different race entirely.

**What's deliberately not used:** weather (no forecast provider integrated) and tyre-compound strategy (Jolpica doesn't expose historical compound data) — `dataAvailability.weather`/`tyreStrategy` are always `false` rather than faked.

**Caching:** an in-memory cache (30 min TTL, keyed by `season-round-stage`) avoids regenerating a prediction on every request within the same pre/post-qualifying stage. Every generated prediction is also persisted to MongoDB (`RacePrediction`) at the moment it's created — that persistence is what makes honest evaluation possible later (see below).

## Prediction Evaluation

Once a predicted race has actually happened, `server/services/evaluationService.js` compares the **stored** prediction (never a regenerated one) against the real Jolpica result:

- Drivers are matched by their stable Jolpica `driverId`, never by display name.
- **Leakage safety:** because nothing was persisted before this feature existed, a small recent window of past races is reconstructed via `buildBacktestPrediction()` — the exact same feature/weight/simulation logic as a live prediction, but fed **round-scoped historical standings** (`/{season}/{round-1}/driverstandings.json`, a genuinely different snapshot from current standings) and recent-form data from strictly earlier rounds. These are clearly tagged `source: "backtest"` end-to-end and never presented as if captured in real time; predictions generated going forward are tagged `"live"`.
- **DNF/DSQ/DNS handling:** a classified retiree (`positionText: "R"`) is scored using Jolpica's real classified finishing position, matching standard motorsport convention; disqualified/withdrawn/unclassified drivers are excluded from position-error math but still shown with their status, never forced into a fake position.
- Metrics: positional error (mean, and per driver), winner accuracy, podium/top-5/top-10 hit rate — all computed only over races where a prediction genuinely existed beforehand and a real result now exists.

Endpoints: `GET /api/predictor/history`, `GET /api/predictor/performance`, `GET /api/predictor/evaluation/:season/:round`.

## Project Structure

```
All_about_F1/
├── client/                 # React + Vite frontend
│   └── src/
│       ├── pages/          # Route-level pages (flat — one file per route)
│       ├── components/     # Shared UI used across multiple pages
│       ├── config/         # API base URL, driver/team asset + colour config
│       ├── data/           # Static reference data (driver/team/circuit info)
│       ├── styles/         # global.css (design tokens) + styles/pages/*.css
│       └── hooks/, utils/  # Small reusable hooks and helpers
└── server/                 # Express REST API
    ├── routes/             # auth, user, drivers, teams, circuits, grand prix, news, live race, predictor
    ├── controllers/        # Thin route handlers
    ├── services/           # f1LiveTimingService, liveRaceService, predictorService, evaluationService, jolpicaClient
    ├── models/             # Mongoose schemas — User, RacePrediction
    ├── middleware/         # JWT auth middleware
    └── config/             # MongoDB connection
```

## Getting Started

### Prerequisites
- Node.js
- A MongoDB instance (local or Atlas)
- A [NewsAPI](https://newsapi.org) API key

### Server setup

```bash
cd server
npm install
```

Create a `.env` file in `server/` (see `server/.env.example`):

```
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
NEWS_API_KEY=your_newsapi_key
```

No credentials are needed for live race data or the predictor — see the architecture sections above.

Run the server:

```bash
npm run dev    # auto-restarts on change (nodemon)
npm start      # plain node, for production
```

### Client setup

```bash
cd client
npm install
npm run dev
```

The client runs on Vite's default dev server (http://localhost:5173) and talks to the API at `http://localhost:3000` by default. To point it at a different backend (e.g. a deployed one), create `client/.env` (see `client/.env.example`):

```
VITE_API_URL=https://your-deployed-backend.example.com
```

### Development commands

| Command | Where | What it does |
|---|---|---|
| `npm run dev` | `client/` | Vite dev server |
| `npm run build` | `client/` | Production frontend build |
| `npm run lint` | `client/` | ESLint |
| `npm run dev` | `server/` | Backend with auto-restart (nodemon) |
| `npm start` | `server/` | Backend, plain `node` |

## API Overview

| Route | Description |
|---|---|
| `/api/health` | Health check — `{ "status": "ok" }` |
| `/auth` | Register / login |
| `/user` | User profile and preferences |
| `/drivers` | Driver data and standings by season |
| `/teams` | Team (constructor) data and standings by season |
| `/grandprixdashboard` | Grand Prix schedule, results, qualifying, pit stops |
| `/circuitmaps` | Circuit details |
| `/news` | Latest F1 news |
| `/profile` | Authenticated user's profile (JWT-protected) |
| `/api/live/race` | Current/next session state — schedule-based, or live via F1's live timing feed during an active session |
| `/api/predictor/upcoming` | Statistical prediction for the next Grand Prix |
| `/api/predictor/history` | Evaluated prediction history for completed races this season |
| `/api/predictor/performance` | Aggregate model performance across evaluated races |
| `/api/predictor/evaluation/:season/:round` | Prediction-vs-reality detail for one race |

## Deployment Notes

**Frontend** — deployable as a static build (e.g. Vercel) via `npm run build` in `client/`. Set `VITE_API_URL` in that host's environment settings to the deployed backend's URL; without it, the build falls back to `http://localhost:3000`, which only works for local development.

**Backend** — requires a persistent Node process (e.g. Render), **not** a serverless/edge function — the F1 live timing connection is a long-lived WebSocket held open by the server, and a short-lived function would drop it on every invocation. Start command: `npm start` (or `node index.js`). Required environment variables: `PORT`, `MONGO_URI`, `JWT_SECRET`, `NEWS_API_KEY` (see `server/.env.example`). `GET /api/health` is available for host health checks.

## Known Limitations

- **Live timing**: not an official/licensed F1 data source (see "Live Data Architecture"); car telemetry and GPS position are unavailable without an F1TV login this project doesn't implement.
- **Race Predictor**: a transparent statistical model, not a trained ML classifier — weights and the simulation's ability transform are documented, reasoned choices, not fitted against held-out data. No weather or tyre-strategy features (no reliable forecast provider integrated; Jolpica has no historical tyre-compound data).
- **Prediction evaluation**: only a small recent window of races has been backtested (to control API load), not the full season history.
- **News**: images come from whatever NewsAPI/the source article provides; a small number of articles have no image and fall back to a neutral placeholder.
