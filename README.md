# All About F1

A full-stack Formula 1 companion app — browse drivers, teams, circuits, and Grand Prix weekends, compare drivers/teams head-to-head, catch up on F1 news, learn the sport through an interactive F1 dictionary, and save your favorite driver/team to a personal profile.

## Tech Stack

**Frontend** — React 19, React Router, Vite, Recharts (standings/telemetry charts), React Three Fiber + Three.js (3D car models), Axios, Lucide icons

**Backend** — Node.js, Express 5, MongoDB with Mongoose, JWT-based authentication, bcrypt

**External APIs**
- [Jolpica (Ergast-compatible) F1 API](https://api.jolpi.ca) — drivers, teams, standings, circuits, and race data
- [NewsAPI](https://newsapi.org) — latest F1 news articles

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
    ├── routes/             # auth, user, drivers, teams, circuits, grand prix, news, preferences
    ├── controllers/        # Route handlers, including calls to Jolpica and NewsAPI
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

Create a `.env` file in `server/`:

```
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
NEWS_API_KEY=your_newsapi_key
```

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
| `/news` | Latest F1 news |
| `/profile` | Authenticated user's profile (JWT-protected) |
