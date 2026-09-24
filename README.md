# All About F1

A full-stack Formula 1 companion app — browse drivers, teams, circuits, and Grand Prix weekends, compare drivers/teams head-to-head, catch up on F1 news, learn the sport through an interactive F1 dictionary, and save your favorite driver/team to a personal profile.

## Tech Stack

**Frontend** — React 19, React Router, Vite, Recharts (standings/telemetry charts), React Three Fiber + Three.js (3D car models), Axios, Lucide icons

**Backend** — Node.js, Express 5, MongoDB with Mongoose, JWT-based authentication, bcrypt

**External APIs**
- [Jolpica (Ergast-compatible) F1 API](https://api.jolpi.ca) — drivers, teams, standings, circuits, and race data
- F1's public live timing feed — real-time session/timing data for the Live Race Dashboard (see below)
- [NewsAPI](https://newsapi.org) — latest F1 news articles

## Live Data Architecture

`GET /api/live/race` combines two providers behind one stable response shape:

- **Jolpica** — the season schedule, race results, qualifying, and standings. It has no genuine live/in-session data, so its schedule is used to estimate when a session *should* be happening.
- **F1 Live Timing** (`server/services/f1LiveTimingService.js`) — the same publicly reachable SignalR stream ([`wss://livetiming.formula1.com/signalrcore`](https://livetiming.formula1.com)) that F1's own broadcast graphics and the open-source [FastF1](https://github.com/theOehrly/Fast-F1) project consume, used here without any login or subscription. When it's actively tracking a session, live driver positions, gaps, lap/sector times, best laps, tyre stints, race control messages, team radio, and weather are preferred and `provider` is reported as `"f1-live-timing"`.

The backend keeps one long-lived connection to the live timing feed (opened once at startup, with automatic reconnect) rather than opening one per request; `liveRaceService.js` merges its state with the Jolpica schedule and normalizes it. No credentials are required or supported for this — when no session is live, the endpoint falls back to schedule-only data with `dataStatus: "unavailable"` instead of crashing.

**Important:** this is not an official, licensed F1 data source — it's a publicly accessible feed, consumed the same way FastF1 does, without authentication. Two channels that carry car telemetry and GPS (`CarData.z`, `Position.z`) are gated behind an F1TV subscription login that this project deliberately does not implement, so speed/throttle/brake/gear/DRS and on-track (x, y) position are not available here; those fields are always returned as `null` rather than faked. Availability of the free channels may change if F1 alters the feed.

## Project Structure

```
All_about_F1/
├── client/                 # React + Vite frontend
│   └── src/
│       ├── pages/          # Route-level pages (Drivers, Teams, Circuits, Grand Prix, Dictionary, Profile, etc.)
│       ├── components/     # Shared UI, plus landing/, entity/, and dictionary/ component groups
│       ├── context/        # Auth and preferences context providers
│       ├── api/            # API client wrappers
│       ├── data/           # Static reference data (driver/team/circuit info)
│       ├── config/         # Team asset/theme config
│       └── hooks/, utils/
└── server/                 # Express REST API
    ├── routes/             # auth, user, drivers, teams, circuits, grand prix, news, preferences, live race
    ├── controllers/        # Route handlers, including calls to Jolpica and NewsAPI
    ├── services/           # f1LiveTimingService (provider integration), liveRaceService (state + normalization)
    ├── models/             # Mongoose schemas (User)
    ├── middleware/          # JWT auth middleware
    └── config/             # MongoDB connection
```

## Features

- **Drivers & Teams** — browse by season, view detailed profiles, and compare two drivers or two teams side by side
- **Grand Prix Dashboard** — race weekend details and circuit maps
- **F1 Dictionary** — glossary of F1 terms with an AI coach mode and a "word of the day" popup
- **News** — latest Formula 1 headlines pulled from NewsAPI
- **Auth & Profile** — sign up/log in, set a favorite driver and team, manage preferences (protected routes via JWT)

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

No credentials are needed for live race data — see "Live Data Architecture" above.

Run the server:

```bash
node index.js
```

### Client setup

```bash
cd client
npm install
npm run dev
```

The client runs on Vite's default dev server (http://localhost:5173) and the API on the port set above (default 3000).

## API Overview

| Route | Description |
|---|---|
| `/auth` | Register / login |
| `/user` | User profile and preferences |
| `/drivers` | Driver data and standings by season |
| `/teams` | Team (constructor) data and standings by season |
| `/grandprixdashboard` | Grand Prix schedule and results |
| `/circuitmaps` | Circuit details |
| `/api/live/race` | Current/next session state — schedule-based, or live via F1's live timing feed during an active session |
| `/news` | Latest F1 news |
| `/profile` | Authenticated user's profile (JWT-protected) |
