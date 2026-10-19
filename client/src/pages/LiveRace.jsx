/*
 * LIVE RACE COMMAND CENTER — reads GET /api/live/race (see server/services/
 * liveRaceService.js). Data/API integration is unchanged from the first
 * version of this page; this is a UI-density redesign only. No circuit/GPS
 * panel and no telemetry panel — both fields are confirmed unavailable from
 * the free live timing feed (no F1TV login), so rather than a placeholder
 * card explaining that, they're simply not present here at all.
 *
 * Polls the backend (never the live provider directly) at an interval that
 * tightens while a session is actually live and relaxes otherwise.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList, PieChart, Pie, Tooltip,
    LineChart, Line, Legend,
} from "recharts";
import {
    Flag, AlertTriangle, Radio as RadioIcon, Thermometer, Droplets, Wind, Users, Signal, Swords, Timer,
    MapPin, Calendar, Trophy, Wrench, UserRound, Cloud,
    CircleDashed, Sun, CloudSun, Cloudy, CloudFog, CloudDrizzle, CloudRain, CloudSnow,
    CloudLightning, ShieldAlert, BarChart2, Gauge, Shuffle, Play, Pause,
} from "lucide-react";
import { EmptyState, Select, Button } from "../components/UI";
import { LayeredImage } from "../components/EntityDetail";
import { getTeamAccent, getDriverAssets, DRIVER_CODE_TO_ID } from "../config/driverAssets";
import "../styles/pages/LiveRace.css";
import { API_BASE_URL as API } from "../config/api";

const POLL_LIVE_MS = 5000;
const POLL_IDLE_MS = 20000;
const FLASH_MS = 900;
const FLASH_FIELDS = ["position", "gapToLeader", "gapToAhead", "lastLap", "bestLap"];

const SESSION_SHORT_LABELS = {
    practice1: "FP1",
    practice2: "FP2",
    practice3: "FP3",
    qualifying: "QUALIFYING",
    sprintQualifying: "SPRINT QUALIFYING",
    sprint: "SPRINT",
    race: "RACE",
};

const COMPOUND_LABELS = { SOFT: "S", MEDIUM: "M", HARD: "H", INTERMEDIATE: "I", WET: "W" };

// Pit-stop counts are a race concept — meaningless (always 0) during a
// qualifying/practice segment, so the timing table and session summary
// hide that column/stat entirely for those session types rather than
// showing a misleading "0".
const RACE_LIKE_SESSIONS = new Set(["race", "sprint"]);
function isRaceLikeSession(sessionType) {
    return RACE_LIKE_SESSIONS.has(sessionType);
}

function sessionShortLabel(type) {
    return SESSION_SHORT_LABELS[type] ?? (type ? type.toUpperCase() : "SESSION");
}

function parseLapTime(t) {
    if (!t || typeof t !== "string") return null;
    const m = t.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
    if (!m) return null;
    return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
}

function timeAgo(iso) {
    if (!iso) return null;
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
}

function formatFlag(status) {
    if (!status) return status;
    return status.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toUpperCase();
}

function parseGapSeconds(gap) {
    if (!gap || typeof gap !== "string" || !gap.startsWith("+")) return null;
    const n = Number(gap.slice(1));
    return Number.isNaN(n) ? null : n;
}

/* ── Data hook ─────────────────────────────────────────────────────── */

function useLiveRace() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const timerRef = useRef(null);
    const isLiveRef = useRef(false);
    const pollRef = useRef(() => {});

    useEffect(() => {
        let cancelled = false;

        const poll = () => {
            clearTimeout(timerRef.current);
            fetch(`${API}/api/live/race`)
                .then((res) => {
                    if (!res.ok) throw new Error("bad status");
                    return res.json();
                })
                .then((json) => {
                    if (cancelled) return;
                    setData(json);
                    setError(false);
                    isLiveRef.current = Boolean(json.isLive);
                })
                .catch(() => {
                    if (cancelled) return;
                    setError(true);
                })
                .finally(() => {
                    if (cancelled) return;
                    setLoading(false);
                    timerRef.current = setTimeout(poll, isLiveRef.current ? POLL_LIVE_MS : POLL_IDLE_MS);
                });
        };

        pollRef.current = poll;
        poll();
        return () => {
            cancelled = true;
            clearTimeout(timerRef.current);
        };
    }, []);

    const retry = () => pollRef.current();

    return { data, error, loading, retry };
}

/* Tracks which driver/field cells changed between polls, for a brief flash.
   Keyed off the `drivers` array reference, which is a fresh array on every
   successful poll — so this only recomputes when new data actually lands. */
function useFlashTracker(drivers) {
    const [prevValues, setPrevValues] = useState(new Map());
    const [flash, setFlash] = useState({ seenDrivers: null, keys: new Set() });

    if (flash.seenDrivers !== drivers) {
        const next = new Map();
        const changed = new Set();
        for (const d of drivers) {
            for (const field of FLASH_FIELDS) {
                const key = `${d.driverNumber}-${field}`;
                const value = d[field];
                next.set(key, value);
                if (prevValues.has(key) && prevValues.get(key) !== value && value != null) {
                    changed.add(key);
                }
            }
        }
        setPrevValues(next);
        setFlash({ seenDrivers: drivers, keys: changed });
    }

    useEffect(() => {
        if (flash.keys.size === 0) return undefined;
        const timer = setTimeout(() => {
            setFlash((f) => (f.keys === flash.keys ? { ...f, keys: new Set() } : f));
        }, FLASH_MS);
        return () => clearTimeout(timer);
    }, [flash.keys]);

    return flash.keys;
}

/* ── Shared driver/team visuals ───────────────────────────────────────
   Two distinct treatments, used deliberately in different contexts:
     - DriverAvatar: a solid team-colour badge carrying the FIA code. Used
       in dense live-timing rows where the feed only ever gives a code and
       name, never a stable asset id — an honest, always-correct avatar
       rather than a guessed/broken photo.
     - DriverPortrait: the real local cutout PNGs from driverAssets.js,
       used only where there's room for them to read properly (Race Hub
       cards, podium, Live Team Focus) and we have a real Ergast driverId
       to resolve them from. ── */

function DriverAvatar({ code, color, size }) {
    return (
        <span className={`lr-driver-avatar${size ? ` lr-driver-avatar--${size}` : ""}`} style={{ background: color || "var(--border-strong)" }} aria-hidden="true">
            {code || "—"}
        </span>
    );
}

function DriverPortrait({ driverId, fullName, frameClassName, fallbackClassName, fallbackIcon }) {
    const candidates = driverId ? getDriverAssets(driverId, fullName).imageCandidates : [];
    return (
        <div className={frameClassName}>
            <LayeredImage
                candidates={candidates}
                alt={fullName || ""}
                fallback={<span className={fallbackClassName}>{fallbackIcon ?? <UserRound size={26} />}</span>}
            />
        </div>
    );
}

/* ── Compact header ────────────────────────────────────────────────── */

/* Non-live gets its own editorial heading — an eyebrow, a large title,
   secondary location, then readable session/date text — rather than the
   compact single-line "badge + title" bar the live dashboard needs to
   stay small. Kept as a separate branch (not a shared markup shape with
   CSS overrides) so the live header stays pixel-identical to before. */
function UpcomingHeader({ race, updatedAt }) {
    return (
        <header className="lr-header lr-header--upcoming">
            <div className="lr-header-row">
                <span className="lr-header-eyebrow lr-mono">NEXT SESSION</span>
                <h1 className="lr-header-title">{race?.grandPrix ?? "No Session Scheduled"}</h1>
                {race?.circuit && (
                    <span className="lr-header-loc">
                        <MapPin size={12} aria-hidden="true" />
                        {race.circuit}{race.country ? `, ${race.country}` : ""}
                    </span>
                )}
                {(race?.session || race?.startTime) && (
                    <span className="lr-header-session lr-mono">
                        {race?.session && sessionShortLabel(race.session)}
                        {race?.session && race?.startTime && " · "}
                        {race?.startTime && new Date(race.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                )}
                {updatedAt && <span className="lr-header-updated lr-mono">UPDATED {timeAgo(updatedAt).toUpperCase()}</span>}
            </div>
        </header>
    );
}

function CompactHeader({ data }) {
    const race = data.race;
    const isLive = data.isLive;
    const weather = data.weather;

    if (!isLive) {
        return <UpcomingHeader race={race} updatedAt={data.updatedAt} />;
    }

    return (
        <header className="lr-header">
            <div className="lr-header-row">
                <span className="lr-badge lr-badge--live">
                    <span className="lr-badge-dot" aria-hidden="true" />
                    LIVE
                </span>
                <div className="lr-header-id">
                    <span className="lr-header-title">{race?.grandPrix ?? "No Session Scheduled"}</span>
                    {race?.circuit && (
                        <span className="lr-header-loc">
                            <MapPin size={12} aria-hidden="true" />
                            {race.circuit}{race.country ? `, ${race.country}` : ""}
                        </span>
                    )}
                </div>
            </div>
            <div className="lr-header-meta">
                {race?.session && <span className="lr-meta-item lr-mono">{sessionShortLabel(race.session)}</span>}
                {data.track?.status && (
                    <span className="lr-meta-item">
                        <span className={`lr-flag-dot lr-flag-dot--${data.track.status.toLowerCase()}`} aria-hidden="true" />
                        {formatFlag(data.track.status)}
                    </span>
                )}
                {weather?.airTemperature != null && (
                    <span className="lr-meta-item lr-mono">{weather.airTemperature}°C</span>
                )}
                {data.updatedAt && <span className="lr-meta-item lr-meta-item--faint lr-mono">UPDATED {timeAgo(data.updatedAt).toUpperCase()}</span>}
            </div>
        </header>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   NON-LIVE HUB — the isLive === false experience. Deliberately small:
   a status line, the previous completed Grand Prix as a driver
   carousel, and the next session/qualifying/race schedule with a
   forecast. One-time fetch on entry, not polled — this content doesn't
   change second to second the way live timing does. No team focus,
   standings, strategy or news here by design; that's a larger "Race
   Hub" this page intentionally isn't building yet.
   ═══════════════════════════════════════════════════════════════════ */

function formatDate(dateStr, timeStr) {
    if (!dateStr) return null;
    const d = new Date(timeStr ? `${dateStr}T${timeStr}` : dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", ...(timeStr ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

/* Only what the non-live page actually renders: the season schedule
   (next session/qualifying/race times + circuit coordinates for the
   forecast) and the most recently completed race's full results. No
   standings/qualifying-history/pit-stop/news fetches — those fed
   sections (Team Focus, Recent Form, Last Strategy, Latest Updates)
   that this page deliberately doesn't have. */
/*
 * Deliberately takes NO season argument — it used to be called with
 * `race?.season`, but `race` (the "next race" guess from Jolpica) can
 * now genuinely be null once that race's own window has passed and
 * Jolpica hasn't advanced "current/next" yet (see isRaceOver in
 * liveRaceService.js) — depending on it here meant the whole hub
 * (results/weather/gap/team-position, nothing to do with "next race"
 * at all) would silently never load in exactly that window. Instead:
 * fetch the latest completed race FIRST (that endpoint needs no season
 * param at all), then use ITS OWN season for the schedule fetch — so
 * this hub is fully independent of whether a "next race" is currently
 * knowable.
 */
function useRaceHubData() {
    const [state, setState] = useState({ loading: true, error: false, schedule: [], latest: null });

    useEffect(() => {
        let cancelled = false;

        const getJson = (path, fallback) =>
            fetch(`${API}${path}`).then((r) => (r.ok ? r.json() : fallback)).catch(() => fallback);

        getJson("/grandprixdashboard/latest", null)
            .then((latest) => {
                if (cancelled) return null;
                const season = latest?.season ?? String(new Date().getFullYear());
                return getJson(`/grandprixdashboard/${season}`, []).then((schedule) => {
                    if (cancelled) return;
                    setState({ loading: false, error: false, schedule, latest });
                });
            })
            .catch(() => {
                if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}


/* ── 4. Next Race Context ─────────────────────────────────────────── */

function NextRaceContext({ hub, race }) {
    if (hub.loading) return <div className="lr-hub-loading">Loading…</div>;
    if (!race) {
        return <EmptyState title="No upcoming race confirmed" description="The schedule will update once the next Grand Prix is confirmed." />;
    }
    const weekend = hub.schedule.find((r) => String(r.round) === String(race?.round));
    if (!weekend) return <EmptyState title="Schedule unavailable" description="Next race schedule couldn't be loaded." />;

    const rows = [
        ["Next Session", race?.session ? `${sessionShortLabel(race.session)} · ${formatDate(race.startTime?.slice(0, 10), race.startTime?.slice(11, 16)) ?? ""}` : "—"],
        ["Qualifying", weekend.Qualifying ? formatDate(weekend.Qualifying.date, weekend.Qualifying.time) : "—"],
        ...(weekend.Sprint ? [["Sprint", formatDate(weekend.Sprint.date, weekend.Sprint.time)]] : []),
        ["Race", formatDate(weekend.date, weekend.time)],
    ];

    return (
        <dl className="lr-pulse">
            {rows.map(([label, value]) => (
                <div className="lr-pulse-row" key={label}>
                    <dt>{label}</dt>
                    <dd className="lr-mono">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

/* ── 5. Next Race Weather — real forecast, from Open-Meteo (free, no key)
   via server/services/weatherService.js. Coordinates come from Jolpica's
   own schedule (Circuit.Location.lat/long, already fetched into
   hub.schedule below) rather than any hardcoded circuit. This is a
   forecast for the next scheduled session — never presented as live
   conditions, which stay driven entirely by the existing live-timing
   weather feed elsewhere on this page. ── */

const WMO_CONDITIONS = {
    0: { label: "Clear sky", Icon: Sun },
    1: { label: "Mostly clear", Icon: CloudSun },
    2: { label: "Partly cloudy", Icon: CloudSun },
    3: { label: "Overcast", Icon: Cloudy },
    45: { label: "Fog", Icon: CloudFog },
    48: { label: "Freezing fog", Icon: CloudFog },
    51: { label: "Light drizzle", Icon: CloudDrizzle },
    53: { label: "Drizzle", Icon: CloudDrizzle },
    55: { label: "Dense drizzle", Icon: CloudDrizzle },
    56: { label: "Freezing drizzle", Icon: CloudDrizzle },
    57: { label: "Freezing drizzle", Icon: CloudDrizzle },
    61: { label: "Light rain", Icon: CloudRain },
    63: { label: "Rain", Icon: CloudRain },
    65: { label: "Heavy rain", Icon: CloudRain },
    66: { label: "Freezing rain", Icon: CloudRain },
    67: { label: "Freezing rain", Icon: CloudRain },
    71: { label: "Light snow", Icon: CloudSnow },
    73: { label: "Snow", Icon: CloudSnow },
    75: { label: "Heavy snow", Icon: CloudSnow },
    77: { label: "Snow grains", Icon: CloudSnow },
    80: { label: "Rain showers", Icon: CloudRain },
    81: { label: "Rain showers", Icon: CloudRain },
    82: { label: "Violent showers", Icon: CloudRain },
    85: { label: "Snow showers", Icon: CloudSnow },
    86: { label: "Snow showers", Icon: CloudSnow },
    95: { label: "Thunderstorm", Icon: CloudLightning },
    96: { label: "Thunderstorm, hail", Icon: CloudLightning },
    99: { label: "Thunderstorm, hail", Icon: CloudLightning },
};

function weatherCondition(code) {
    return WMO_CONDITIONS[code] ?? { label: "—", Icon: Cloud };
}

const COMPASS_POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

function compassDirection(deg) {
    if (deg == null) return null;
    return COMPASS_POINTS[Math.round(deg / 22.5) % 16];
}

function useWeatherForecast(lat, lon, targetIso) {
    const hasParams = lat != null && lon != null && Boolean(targetIso);
    const key = `${lat}|${lon}|${targetIso}`;

    // Reset synchronously during render when the target changes, rather
    // than as the first act of the effect below.
    const [state, setState] = useState({ seenKey: key, status: hasParams ? "loading" : "unavailable", data: null });
    if (state.seenKey !== key) {
        setState({ seenKey: key, status: hasParams ? "loading" : "unavailable", data: null });
    }

    useEffect(() => {
        if (!hasParams) return undefined;
        let cancelled = false;

        fetch(`${API}/weather/forecast?lat=${lat}&lon=${lon}&time=${encodeURIComponent(targetIso)}`)
            .then((res) => (res.ok ? res.json() : { available: false }))
            .then((json) => {
                if (cancelled) return;
                setState((s) => ({ ...s, status: json?.available ? "ready" : "unavailable", data: json?.available ? json : null }));
            })
            .catch(() => {
                if (!cancelled) setState((s) => ({ ...s, status: "error", data: null }));
            });

        return () => {
            cancelled = true;
        };
    }, [lat, lon, targetIso, hasParams]);

    return state;
}

function NextRaceWeatherForecast({ hub, race }) {
    const weekend = hub.schedule.find((r) => String(r.round) === String(race?.round));
    const location = weekend?.Circuit?.Location;
    const lat = location?.lat != null ? Number(location.lat) : null;
    const lon = location?.long != null ? Number(location.long) : null;
    const targetIso = race?.startTime ?? null;

    const forecast = useWeatherForecast(lat, lon, targetIso);

    if (hub.loading) return <div className="lr-hub-loading">Loading…</div>;

    // Distinct from "we know the race but have no forecast for it" below —
    // this is "there's no confirmed upcoming race to forecast at all" (see
    // isRaceOver in liveRaceService.js), which reads very differently.
    if (!race) {
        return (
            <div className="lr-compact-empty">
                <Cloud size={18} aria-hidden="true" />
                <div className="lr-compact-empty-body">
                    <span className="lr-compact-empty-title">NO UPCOMING RACE CONFIRMED</span>
                    <span className="lr-compact-empty-desc">The next Grand Prix hasn't been confirmed by the schedule yet.</span>
                </div>
            </div>
        );
    }

    if (forecast.status === "loading" || forecast.status === "idle") {
        return <div className="lr-hub-loading">Loading forecast…</div>;
    }

    if (forecast.status === "error") {
        return (
            <div className="lr-compact-empty">
                <Cloud size={18} aria-hidden="true" />
                <div className="lr-compact-empty-body">
                    <span className="lr-compact-empty-title">FORECAST UNAVAILABLE</span>
                    <span className="lr-compact-empty-desc">Couldn't reach the weather service. Try again shortly.</span>
                </div>
            </div>
        );
    }

    if (forecast.status === "unavailable" || !forecast.data) {
        return (
            <div className="lr-compact-empty">
                <Cloud size={18} aria-hidden="true" />
                <div className="lr-compact-empty-body">
                    <span className="lr-compact-empty-title">FORECAST UNAVAILABLE</span>
                    <span className="lr-compact-empty-desc">
                        {lat == null
                            ? "Circuit location isn't available for this race yet."
                            : "This session is too far out for a forecast — Open-Meteo only forecasts about 16 days ahead."}
                    </span>
                </div>
            </div>
        );
    }

    const f = forecast.data;
    const condition = weatherCondition(f.weatherCode);
    const direction = compassDirection(f.windDirection);
    const appliesTo = new Date(f.forecastFor).toLocaleString(undefined, {
        weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const stats = [
        f.airTemperature != null && { icon: <Thermometer size={14} aria-hidden="true" />, label: "Air Temp", value: `${Math.round(f.airTemperature)}°C` },
        f.precipitationProbability != null && { icon: <Droplets size={14} aria-hidden="true" />, label: "Rain Chance", value: `${f.precipitationProbability}%` },
        f.windSpeed != null && { icon: <Wind size={14} aria-hidden="true" />, label: "Wind", value: `${Math.round(f.windSpeed)} km/h${direction ? ` ${direction}` : ""}` },
        f.humidity != null && { icon: <Droplets size={14} aria-hidden="true" />, label: "Humidity", value: `${f.humidity}%` },
    ].filter(Boolean);

    return (
        <div className="lr-forecast">
            <div className="lr-forecast-head">
                <span className="lr-forecast-badge">FORECAST</span>
                <span className="lr-forecast-condition">
                    <condition.Icon size={16} aria-hidden="true" />
                    {condition.label}
                </span>
            </div>
            <span className="lr-forecast-applies">For {sessionShortLabel(race?.session)} · {appliesTo}</span>
            <div className="lr-forecast-grid">
                {stats.map((s) => (
                    <div className="lr-forecast-stat" key={s.label}>
                        <span className="lr-forecast-stat-icon">{s.icon}</span>
                        <div>
                            <span className="lr-forecast-stat-value lr-mono">{s.value}</span>
                            <span className="lr-forecast-stat-label">{s.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Recent Grand Prix Results — the most recently completed race
   (Jolpica current/last, real results, never inferred/hardcoded), the
   complete classification table only — replaces the old one-card-per-
   driver carousel. GP name/circuit/date and every result row all come
   from the same `latest` fetch, so they can never drift out of sync
   with each other. ───────────────────────────────────────────────── */

// "Finished" or a classified-but-lapped "+N Lap(s)" both count as a
// real classification, not a DNF — only those two read as normal rows;
// everything else (Retired, Accident, Disqualified, Did not start…)
// gets the dimmed/status treatment.
function isClassifiedFinish(status) {
    return status === "Finished" || (typeof status === "string" && status.startsWith("+"));
}

function ClassificationTable({ results }) {
    return (
        <div className="lr-timing-scroll lr-timing-scroll--capped">
            <table className="lr-timing">
                <thead>
                    <tr>
                        <th>Pos</th><th>Driver</th><th>Team</th><th>Laps</th><th>Time / Gap</th><th>Pts</th>
                    </tr>
                </thead>
                <tbody>
                    {results.map((r) => {
                        const fullName = `${r.Driver.givenName} ${r.Driver.familyName}`;
                        const classified = isClassifiedFinish(r.status);
                        return (
                            <tr key={r.Driver.driverId} className={!classified ? "lr-row-retired" : ""}>
                                <td className="lr-mono lr-timing-pos">{r.positionText ?? r.position}</td>
                                <td>
                                    <span className="lr-driver-chip">
                                        <DriverAvatar code={r.Driver.code ?? r.Driver.driverId} size="sm" />
                                        {fullName}
                                    </span>
                                </td>
                                <td>{r.Constructor.name}</td>
                                <td className="lr-mono">{r.laps ?? "—"}</td>
                                <td className="lr-mono">{classified ? (r.Time?.time ?? "—") : r.status}</td>
                                <td className="lr-mono">{r.points ?? "0"}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/*
 * The heading (name/circuit/date) renders unconditionally once a race
 * has been identified (getLatestRace determines this from the real
 * calendar now, not from whether results exist yet — see
 * grandprixController.js) — so Singapore's own identity shows here the
 * moment its race time has passed, even in the minutes/hours before
 * Jolpica has posted its classification. Only the table below swaps
 * to a "pending" state; the heading is never generic and never
 * silently reverts to an older race.
 */
function RaceResultsSection({ latest }) {
    const hasResults = Boolean(latest?.Results?.length);

    return (
        <div className="lr-gp">
            <div className="lr-gp-head">
                <span className="lr-gp-name">{latest?.raceName ?? "—"}</span>
                <span className="lr-gp-meta">
                    <MapPin size={12} aria-hidden="true" />
                    {latest?.Circuit?.circuitName}{latest?.Circuit?.Location?.country ? `, ${latest.Circuit.Location.country}` : ""}
                    <span className="lr-mono">{formatDate(latest?.date)}</span>
                </span>
            </div>
            {hasResults ? (
                <ClassificationTable results={latest.Results} />
            ) : (
                <div className="lr-compact-empty">
                    <Trophy size={18} aria-hidden="true" />
                    <div className="lr-compact-empty-body">
                        <span className="lr-compact-empty-title">CLASSIFICATION PENDING</span>
                        <span className="lr-compact-empty-desc">
                            {latest?.raceName ?? "This race"}'s official classification hasn't been posted by the data provider yet.
                            {latest?.liveConfirmation?.raceFinished && (
                                <> Live timing confirms the race finished ({latest.liveConfirmation.currentLap}/{latest.liveConfirmation.totalLaps} laps).</>
                            )}
                            {" "}It'll appear here automatically once it is.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Post-race Session Pulse — "most recently completed session's
   available summary and statistics", per the brief, entirely derived
   from the SAME `latest` results already fetched for the section
   above — no extra request. Mirrors the live Session Pulse's own
   tile-grid shape (.lr-pulse-grid/.lr-pulse-tile) so both states of
   the SAME panel share one visual language, not two different ones. */
function PostRaceSessionPulse({ latest }) {
    const results = latest?.Results ?? [];
    if (results.length === 0) {
        return latest?.resultsPending ? (
            <EmptyState
                title="Summary pending"
                description={`${latest?.raceName ?? "This race"}'s session summary will appear once its classification is posted.`}
            />
        ) : (
            <EmptyState title="No recent session" description="A summary will appear once a session has been completed." />
        );
    }

    const winner = results.find((r) => r.position === "1");
    const polesitter = results.find((r) => r.grid === "1");
    const fastestLapResult = results.find((r) => r.FastestLap?.rank === "1");
    const dnfCount = results.filter((r) => !isClassifiedFinish(r.status)).length;

    const tiles = [
        {
            icon: <Trophy size={15} aria-hidden="true" />,
            label: "Winner",
            value: winner?.Driver.code ?? "—",
            sub: winner?.Constructor.name ?? null,
            accent: true,
        },
        {
            icon: <Timer size={15} aria-hidden="true" />,
            label: "Fastest",
            value: fastestLapResult?.Driver.code ?? "—",
            sub: fastestLapResult?.FastestLap?.Time?.time ?? null,
        },
        {
            icon: <Flag size={15} aria-hidden="true" />,
            label: "Pole → Finish",
            value: polesitter ? `P1→P${polesitter.position}` : "—",
            sub: polesitter?.Driver.code ?? null,
        },
        {
            icon: <Gauge size={15} aria-hidden="true" />,
            label: "Laps",
            value: winner?.laps ?? "—",
            sub: "COMPLETED",
        },
        {
            icon: <Users size={15} aria-hidden="true" />,
            label: "Classified",
            value: `${results.length - dnfCount}/${results.length}`,
            sub: null,
        },
        {
            icon: <AlertTriangle size={15} aria-hidden="true" />,
            label: "DNF / Retired",
            value: dnfCount,
            sub: null,
        },
    ];

    return (
        <div className="lr-pulse-grid">
            {tiles.map((tile) => (
                <div className={`lr-pulse-tile${tile.accent ? " lr-pulse-tile--accent" : ""}`} key={tile.label}>
                    <span className="lr-pulse-tile-icon">{tile.icon}</span>
                    <span className="lr-pulse-tile-label">{tile.label}</span>
                    <span className="lr-mono lr-pulse-tile-value">{tile.value}</span>
                    {tile.sub && <span className="lr-pulse-tile-sub">{tile.sub}</span>}
                </div>
            ))}
        </div>
    );
}

/* ── No session status line ───────────────────────────────────────── */

function NoSessionBanner() {
    return (
        <div className="lr-nosession">
            <span className="lr-badge-dot" aria-hidden="true" />
            NO SESSION LIVE
            <span className="lr-nosession-desc">No Formula 1 session is currently running.</span>
        </div>
    );
}

/* ── Non-live orchestrator ─────────────────────────────────────────── */

/* Three states, determined from actual data/timestamps, never a
   manually-set label:
     LIVE                      — handled entirely outside this
                                  component (see LiveRace() below);
                                  isLive comes straight from the
                                  backend's own session-time check.
     POST-RACE / NO SESSION    — isLive is false AND the most recent
                                  race (Jolpica current/last) has real
                                  Results. Full podium/classification/
                                  weather/gap/position/pulse.
     UPCOMING / NO RESULTS     — isLive is false AND there are no
                                  Results yet at all (e.g. between
                                  seasons) — just the schedule, plus an
                                  honest empty state rather than
                                  rendering charts for a race that
                                  doesn't exist. */
function NonLiveHub({ race }) {
    const hub = useRaceHubData();

    if (hub.loading) {
        return (
            <div className="lr-hub">
                <NoSessionBanner />
                <div className="lr-hub-loading">Loading latest results…</div>
            </div>
        );
    }

    const latest = hub.latest;

    /*
     * Three distinct cases now, not two — getLatestRace (see
     * grandprixController.js) determines the selected race from the
     * real calendar, not from Jolpica's own lagging current/last
     * pointer, so the race's IDENTITY (name/circuit/date) can be known
     * — and should be shown — even while its classification genuinely
     * hasn't posted yet:
     *   1. !latest?.available — no completed race exists at all this
     *      season (rare: start of a season, or the schedule fetch
     *      itself failed). Generic empty state, nothing to name.
     *   2. latest.resultsPending — the race IS known (e.g. Singapore),
     *      its results just aren't posted yet. Shows its real identity
     *      plus real historical weather (works from circuit+date alone,
     *      independent of Results) and an honest "pending" state for
     *      everything that genuinely needs Results.
     *   3. Full results available — the complete post-race dashboard.
     * All three share the SAME markup below — RaceResultsSection,
     * PostRaceGapChart, PostRaceTeamPositionChart and
     * PostRaceSessionPulse each already degrade to an honest, race-
     * specific "pending" message from latest.resultsPending/raceName
     * when Results is empty, so there's no separate branch needed for
     * case 2 vs 3 here. */
    if (!latest?.available) {
        return (
            <div className="lr-hub">
                <NoSessionBanner />
                <Panel title={<><Trophy size={13} aria-hidden="true" />Recent Grand Prix Results</>} className="lr-panel--full">
                    <EmptyState title="No completed races yet" description="Results will appear here once a Grand Prix has been completed." />
                </Panel>
                <div className="lr-grid lr-grid--6-6">
                    <Panel title={<><Calendar size={13} aria-hidden="true" />Next Race</>}>
                        <NextRaceContext hub={hub} race={race} />
                    </Panel>
                    <Panel title={<><Cloud size={13} aria-hidden="true" />Next Race Weather</>} className="lr-panel--chalk">
                        <NextRaceWeatherForecast hub={hub} race={race} />
                    </Panel>
                </div>
            </div>
        );
    }

    return (
        <div className="lr-hub">
            <NoSessionBanner />

            {/* 1-3: identity/date, podium, full classification — one section. */}
            <Panel title={<><Trophy size={13} aria-hidden="true" />Recent Grand Prix Results</>} className="lr-panel--full">
                <RaceResultsSection latest={latest} />
            </Panel>

            {/* 4-5: historical race-time weather, then gap/team-position —
               read in that order left-to-right, top-to-bottom. Weather
               renders real conditions for this exact race even while its
               results are still pending — it only needs the circuit +
               date, never the classification. */}
            <div className="lr-grid lr-grid--6-6">
                <Panel title={<><Cloud size={13} aria-hidden="true" />Weather</>}>
                    <PostRaceWeatherSection latest={latest} />
                </Panel>
                <Panel title={<><BarChart2 size={13} aria-hidden="true" />Gap to Leader</>}>
                    <PostRaceGapChart latest={latest} />
                </Panel>
            </div>

            <div className="lr-grid lr-grid--6-6">
                <Panel title={<><Shuffle size={13} aria-hidden="true" />Team Position</>}>
                    <PostRaceTeamPositionChart latest={latest} />
                </Panel>
                {/* 6: session pulse, last in the completed-race priority list. */}
                <Panel title={<><Signal size={13} aria-hidden="true" />Session Pulse</>}>
                    <PostRaceSessionPulse latest={latest} />
                </Panel>
            </div>

            {/* Upcoming-race information stays in its own clearly labelled
               section, never mixed into the historical results above. */}
            <div className="lr-grid lr-grid--6-6">
                <Panel title={<><Calendar size={13} aria-hidden="true" />Next Race</>}>
                    <NextRaceContext hub={hub} race={race} />
                </Panel>
                <Panel title={<><Cloud size={13} aria-hidden="true" />Next Race Weather</>} className="lr-panel--chalk">
                    <NextRaceWeatherForecast hub={hub} race={race} />
                </Panel>
            </div>
        </div>
    );
}

/* ── Live timing (dominant section) ───────────────────────────────── */

function LiveTimingTable({ drivers, sessionType }) {
    const flashKeys = useFlashTracker(drivers);

    if (drivers.length === 0) {
        return <EmptyState title="No timing data yet" description="Driver timing will appear as soon as the session reports it." />;
    }
    const sorted = [...drivers].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
    const showStops = isRaceLikeSession(sessionType);

    const cell = (driverNumber, field, value, className = "") => (
        <td className={`lr-mono${className ? ` ${className}` : ""}`}>
            <span className={flashKeys.has(`${driverNumber}-${field}`) ? "lr-flash" : ""}>{value ?? "—"}</span>
        </td>
    );

    return (
        <div className="lr-timing-scroll">
            <table className="lr-timing">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Driver</th>
                        <th>Team</th>
                        <th>Gap</th>
                        <th>Int</th>
                        <th>Tyre</th>
                        <th>Age</th>
                        <th>Last Lap</th>
                        <th>Best Lap</th>
                        {showStops && <th>Stops</th>}
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((d) => (
                        <tr key={d.driverNumber} className={d.status !== "racing" ? `lr-row-${d.status}` : ""}>
                            {cell(d.driverNumber, "position", d.position, "lr-timing-pos")}
                            <td>
                                <span className="lr-driver-chip">
                                    <DriverAvatar code={d.driverCode ?? String(d.driverNumber)} color={d.teamColor} size="sm" />
                                    <span className="lr-driver-name">{d.name ?? `#${d.driverNumber}`}</span>
                                </span>
                            </td>
                            <td className="lr-timing-team">{d.team ?? "—"}</td>
                            {cell(d.driverNumber, "gapToLeader", d.gapToLeader)}
                            {cell(d.driverNumber, "gapToAhead", d.gapToAhead)}
                            <td>
                                {d.currentTyre ? (
                                    <span className={`lr-tyre lr-tyre--${d.currentTyre.toLowerCase()}`} title={d.currentTyre}>
                                        {COMPOUND_LABELS[d.currentTyre] ?? d.currentTyre[0]}
                                    </span>
                                ) : "—"}
                            </td>
                            <td className="lr-mono">{d.tyreAge ?? "—"}</td>
                            {cell(d.driverNumber, "lastLap", d.lastLap)}
                            {cell(d.driverNumber, "bestLap", d.bestLap)}
                            {showStops && <td className="lr-mono">{d.pitStops}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ── Session KPI strip ─────────────────────────────────────────────── */

/* The dashboard's top-line instrument strip — five tiles, no card chrome,
   sitting directly under the header the way a timing-tower or Tableau
   dashboard leads with headline numbers before any detail module. Lap
   count comes straight from the live LapCount feed (liveState.lapCount
   in f1LiveTimingService.js); TotalLaps is frequently null mid-session
   (F1 doesn't always publish it), so the "/total" half is only appended
   when it's genuinely present — never guessed from the schedule. */
function SessionKpiStrip({ data, drivers }) {
    const fastest = drivers
        .map((d) => ({ d, secs: parseLapTime(d.bestLap) }))
        .filter((x) => x.secs !== null)
        .sort((a, b) => a.secs - b.secs)[0];

    const trackStatus = data.track?.status;
    const currentLap = data.race?.currentLap;
    const totalLaps = data.race?.totalLaps;

    const tiles = [
        {
            icon: <Signal size={15} aria-hidden="true" />,
            label: "Session",
            value: sessionShortLabel(data.race?.session),
            sub: <span className="lr-pulse-live"><span className="lr-badge-dot" aria-hidden="true" />LIVE</span>,
        },
        {
            icon: <Gauge size={15} aria-hidden="true" />,
            label: "Lap",
            value: currentLap != null ? `${currentLap}${totalLaps != null ? `/${totalLaps}` : ""}` : "—",
            sub: null,
        },
        {
            icon: <Users size={15} aria-hidden="true" />,
            label: "Drivers",
            value: drivers.length || "—",
            sub: "REPORTING",
        },
        {
            icon: <Timer size={15} aria-hidden="true" />,
            label: "Fastest Lap",
            value: fastest ? fastest.d.driverCode : "—",
            sub: fastest ? fastest.d.bestLap : null,
            accent: true,
        },
        {
            icon: <Flag size={15} aria-hidden="true" />,
            label: "Track",
            value: trackStatus ? formatFlag(trackStatus) : "—",
            sub: trackStatus ? <span className={`lr-flag-dot lr-flag-dot--${trackStatus.toLowerCase()}`} aria-hidden="true" /> : null,
        },
    ];

    return (
        <div className="lr-kpi-strip">
            {tiles.map((tile) => (
                <div className={`lr-pulse-tile${tile.accent ? " lr-pulse-tile--accent" : ""}`} key={tile.label}>
                    <span className="lr-pulse-tile-icon">{tile.icon}</span>
                    <span className="lr-pulse-tile-label">{tile.label}</span>
                    <span className="lr-mono lr-pulse-tile-value">{tile.value}</span>
                    {tile.sub && <span className="lr-pulse-tile-sub">{tile.sub}</span>}
                </div>
            ))}
        </div>
    );
}

/* ── Session Pulse (full panel) ───────────────────────────────────────
   The KPI strip up top is a five-tile headline row; this is the fuller
   status panel paired with Team Focus in the dashboard mosaic — same
   Session/Lap/Drivers/Fastest/Track reads plus Weather, Pit Stops and
   Race Control's event count, all real fields already on `data`. ──── */
function SessionPulsePanel({ data, drivers }) {
    const fastest = drivers
        .map((d) => ({ d, secs: parseLapTime(d.bestLap) }))
        .filter((x) => x.secs !== null)
        .sort((a, b) => a.secs - b.secs)[0];

    const trackStatus = data.track?.status;
    const currentLap = data.race?.currentLap;
    const totalLaps = data.race?.totalLaps;
    const raceLike = isRaceLikeSession(data.race?.session);
    const totalPitStops = drivers.reduce((sum, d) => sum + (d.pitStops || 0), 0);

    const tiles = [
        {
            icon: <Signal size={15} aria-hidden="true" />,
            label: "Session",
            value: sessionShortLabel(data.race?.session),
            sub: <span className="lr-pulse-live"><span className="lr-badge-dot" aria-hidden="true" />LIVE</span>,
        },
        {
            icon: <Gauge size={15} aria-hidden="true" />,
            label: "Lap",
            value: currentLap != null ? `${currentLap}${totalLaps != null ? `/${totalLaps}` : ""}` : "—",
            sub: null,
        },
        {
            icon: <Users size={15} aria-hidden="true" />,
            label: "Drivers",
            value: drivers.length || "—",
            sub: "REPORTING",
        },
        {
            icon: <Timer size={15} aria-hidden="true" />,
            label: "Fastest",
            value: fastest ? fastest.d.driverCode : "—",
            sub: fastest ? fastest.d.bestLap : null,
            accent: true,
        },
        {
            icon: <Flag size={15} aria-hidden="true" />,
            label: "Track",
            value: trackStatus ? formatFlag(trackStatus) : "—",
            sub: trackStatus ? <span className={`lr-flag-dot lr-flag-dot--${trackStatus.toLowerCase()}`} aria-hidden="true" /> : null,
        },
        {
            icon: <Thermometer size={15} aria-hidden="true" />,
            label: "Weather",
            value: data.weather?.airTemperature != null ? `${data.weather.airTemperature}°C` : "—",
            sub: data.weather ? (data.weather.rainfall > 0 ? "RAIN" : "DRY") : null,
        },
        {
            icon: <Wrench size={15} aria-hidden="true" />,
            label: "Pit Stops",
            value: raceLike ? (totalPitStops || "—") : "—",
            sub: raceLike ? null : "N/A",
        },
        {
            icon: <AlertTriangle size={15} aria-hidden="true" />,
            label: "Race Control",
            value: data.events?.length ?? 0,
            sub: "EVENTS",
        },
    ];

    return (
        <div className="lr-pulse-grid">
            {tiles.map((tile) => (
                <div className={`lr-pulse-tile${tile.accent ? " lr-pulse-tile--accent" : ""}`} key={tile.label}>
                    <span className="lr-pulse-tile-icon">{tile.icon}</span>
                    <span className="lr-pulse-tile-label">{tile.label}</span>
                    <span className="lr-mono lr-pulse-tile-value">{tile.value}</span>
                    {tile.sub && <span className="lr-pulse-tile-sub">{tile.sub}</span>}
                </div>
            ))}
        </div>
    );
}

/* ── Team focus — the teammate-vs-teammate comparison, already has a
   team selector and already compares two drivers' current positions
   (head row) plus a shared stat set. Same lap-history gap as Team
   Position below: no per-lap log exists on the live feed, so this
   stays a current-snapshot comparison rather than a line graph with
   fabricated history. ─────────────────────────────────────────────── */

/* Championship position isn't part of the live feed at all — this reuses
   the existing historical standings endpoint (already used by pages/
   Drivers.jsx) rather than inventing it. Fetched once per season, not
   re-fetched on every live poll. */
function useChampionshipPositions(season) {
    const [byNumber, setByNumber] = useState(new Map());

    useEffect(() => {
        if (!season) return;
        let cancelled = false;
        fetch(`${API}/drivers/standings/${season}`)
            .then((res) => (res.ok ? res.json() : []))
            .then((standings) => {
                if (cancelled || !Array.isArray(standings)) return;
                const map = new Map();
                for (const s of standings) {
                    if (s.Driver?.permanentNumber) map.set(s.Driver.permanentNumber, s.position);
                }
                setByNumber(map);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [season]);

    return byNumber;
}

function TeamFocus({ drivers, season }) {
    const championship = useChampionshipPositions(season);

    const teams = useMemo(() => {
        const map = new Map();
        for (const d of drivers) {
            if (d.team && !map.has(d.team)) map.set(d.team, d.teamColor);
        }
        return Array.from(map.entries());
    }, [drivers]);

    const [selected, setSelected] = useState(null);
    const activeTeam = selected ?? teams[0]?.[0] ?? null;

    if (teams.length === 0) {
        return <EmptyState title="No teams reporting yet" description="Team data will appear once drivers are on track." />;
    }

    const teamDrivers = drivers
        .filter((d) => d.team === activeTeam)
        .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

    const TEAM_STAT_ROWS = [
        ["Championship", (d) => {
            const pos = championship.get(String(d.driverNumber));
            return pos ? `P${pos}` : "—";
        }],
        ["Last Lap", (d) => d.lastLap ?? "—"],
        ["Best Lap", (d) => d.bestLap ?? "—"],
        ["Gap", (d) => d.gapToLeader ?? "—"],
        ["Tyre", (d) => (d.currentTyre ? `${COMPOUND_LABELS[d.currentTyre] ?? d.currentTyre[0]}${d.tyreAge != null ? ` (${d.tyreAge})` : ""}` : "—")],
        ["Stops", (d) => d.pitStops],
    ];

    const teamAccent = teamDrivers[0]?.teamColor ?? "var(--border-strong)";

    return (
        <div className="lr-team-focus" style={{ "--lr-team-accent": teamAccent }}>
            <Select value={activeTeam ?? ""} onChange={(e) => setSelected(e.target.value)} className="lr-team-select">
                {teams.map(([team]) => <option key={team} value={team}>{team}</option>)}
            </Select>
            {teamDrivers.length === 0 ? (
                <EmptyState title="No drivers reporting" description="This team has no live data yet." />
            ) : (
                <>
                <div className="lr-team-compare-portraits" style={{ "--lr-team-cols": teamDrivers.length }}>
                    {teamDrivers.map((d) => (
                        <DriverPortrait
                            key={d.driverNumber}
                            driverId={DRIVER_CODE_TO_ID[d.driverCode]}
                            fullName={d.name}
                            frameClassName="lr-driver-card-photo lr-team-compare-photo"
                            fallbackClassName="lr-driver-card-photo-fallback"
                            fallbackIcon={<DriverAvatar code={d.driverCode ?? String(d.driverNumber)} color={d.teamColor} size="lg" />}
                        />
                    ))}
                </div>
                <div className="lr-team-compare" style={{ "--lr-team-cols": teamDrivers.length }}>
                    <div className="lr-team-compare-row lr-team-compare-head">
                        {teamDrivers.map((d) => (
                            <div className="lr-team-compare-driver" key={d.driverNumber}>
                                <DriverAvatar code={d.driverCode ?? String(d.driverNumber)} color={d.teamColor} size="sm" />
                                <span className="lr-mono lr-team-compare-pos">P{d.position ?? "—"}</span>
                            </div>
                        ))}
                    </div>
                    {TEAM_STAT_ROWS.map(([label, get]) => (
                        <div className="lr-team-compare-row" key={label}>
                            {teamDrivers.map((d) => (
                                <div className="lr-team-compare-cell" key={d.driverNumber}>
                                    <span className="lr-team-compare-label">{label}</span>
                                    <span className="lr-mono lr-team-compare-value">{get(d)}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                </>
            )}
        </div>
    );
}

/* ── Team / driver performance — real current positions only, grouped
   by team and ordered by each team's best-placed car.
   A lap-by-lap position LINE graph is the better chart for this, but
   the live feed (see liveRaceService.js) only ever reports each car's
   CURRENT Position — no per-lap history is kept anywhere, so a line
   across laps would mean inventing every point except the last one.
   Rather than fabricate that history, this stays a current-position
   comparison (the explicitly allowed fallback) and picks up the two
   improvements that don't require history: a team filter, and a
   tooltip that surfaces the race's actual current lap alongside each
   driver's real position — both genuinely available fields. Bar
   length is a simple inverse-of-position read (P1 = full bar) so the
   field's shape is visible at a glance. ───────────────────── */

function TeamPerformanceSection({ drivers, currentLap }) {
    const [teamFilter, setTeamFilter] = useState("all");
    const fieldSize = drivers.length || 20;

    const byTeam = new Map();
    for (const d of drivers) {
        if (!d.team || d.position == null) continue;
        if (!byTeam.has(d.team)) byTeam.set(d.team, { color: d.teamColor, drivers: [] });
        byTeam.get(d.team).drivers.push(d);
    }

    const allTeams = Array.from(byTeam.entries())
        .map(([team, v]) => ({ team, color: v.color, drivers: v.drivers.sort((a, b) => a.position - b.position) }))
        .sort((a, b) => a.drivers[0].position - b.drivers[0].position);

    if (allTeams.length === 0) {
        return <EmptyState title="No positions yet" description="Team performance will appear once drivers are classified." />;
    }

    const teams = teamFilter === "all" ? allTeams : allTeams.filter((t) => t.team === teamFilter);

    return (
        <div className="lr-team-perf-wrap">
            <Select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="lr-team-select">
                <option value="all">All Teams</option>
                {allTeams.map((t) => <option key={t.team} value={t.team}>{t.team}</option>)}
            </Select>
            <div className="lr-team-perf">
                {teams.map((t) => (
                    <div className="lr-team-perf-row" key={t.team}>
                        <span className="lr-team-perf-name">{t.team}</span>
                        <div className="lr-team-perf-bars">
                            {t.drivers.map((d) => (
                                <span
                                    className="lr-team-perf-bar-wrap"
                                    key={d.driverNumber}
                                    title={`${d.driverCode ?? d.driverNumber} — P${d.position}${currentLap != null ? ` on lap ${currentLap}` : ""}`}
                                >
                                    <span
                                        className="lr-team-perf-bar"
                                        style={{ width: `${Math.max(8, ((fieldSize - d.position + 1) / fieldSize) * 100)}%`, background: t.color }}
                                    />
                                    <span className="lr-mono lr-team-perf-pos">P{d.position}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Battles — derived only from position + live gap-to-ahead ────────── */

const MAX_BATTLES = 6;

function BattlesSection({ drivers }) {
    const racing = drivers.filter((d) => d.status === "racing" && d.position != null);
    const battles = racing
        .map((d) => {
            const gap = parseGapSeconds(d.gapToAhead);
            if (gap === null || gap > 1.0) return null;
            const ahead = racing.find((o) => o.position === d.position - 1);
            if (!ahead) return null;
            return { car: d, ahead, gap };
        })
        .filter(Boolean)
        .sort((a, b) => a.gap - b.gap)
        .slice(0, MAX_BATTLES);

    if (battles.length === 0) {
        return (
            <div className="lr-compact-empty">
                <Swords size={18} aria-hidden="true" />
                <div className="lr-compact-empty-body">
                    <span className="lr-compact-empty-title">NO ACTIVE BATTLES</span>
                    <span className="lr-compact-empty-desc">No drivers currently within 1.0s.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="lr-battles-list">
            {battles.map(({ car, ahead, gap }) => {
                // Pace delta from the real lastLap field only — a positive
                // number means the chasing car is currently lapping slower
                // than the car ahead. No DRS/telemetry chip here: drs is
                // confirmed always null on the free feed (no F1TV), so it's
                // left out rather than shown as a fabricated always-off state.
                const carSecs = parseLapTime(car.lastLap);
                const aheadSecs = parseLapTime(ahead.lastLap);
                const paceDelta = carSecs != null && aheadSecs != null ? carSecs - aheadSecs : null;

                return (
                    <div className="lr-battle-card" key={car.driverNumber}>
                        <span className="lr-battle-heading">BATTLE FOR P{car.position}</span>

                        <div className="lr-battle-duel">
                            <div className="lr-battle-side">
                                <DriverAvatar code={ahead.driverCode} color={ahead.teamColor} />
                                <div className="lr-battle-side-id">
                                    <span className="lr-battle-side-name">{ahead.name ?? ahead.driverCode}</span>
                                    <span className="lr-battle-side-team">{ahead.team ?? "—"}</span>
                                </div>
                                <span className="lr-mono lr-battle-side-pos">P{ahead.position}</span>
                            </div>

                            <div className="lr-battle-connector" aria-hidden="true">
                                <span className="lr-battle-connector-line" />
                                <span className="lr-battle-gap lr-mono">{gap.toFixed(3)}s</span>
                                <span className="lr-battle-connector-line" />
                            </div>

                            <div className="lr-battle-side">
                                <DriverAvatar code={car.driverCode} color={car.teamColor} />
                                <div className="lr-battle-side-id">
                                    <span className="lr-battle-side-name">{car.name ?? car.driverCode}</span>
                                    <span className="lr-battle-side-team">{car.team ?? "—"}</span>
                                </div>
                                <span className="lr-mono lr-battle-side-pos">P{car.position}</span>
                            </div>
                        </div>

                        <div className="lr-battle-foot">
                            {gap < 0.3 && <span className="lr-battle-tag">CLOSE FIGHT</span>}
                            {paceDelta != null && (
                                <span className="lr-battle-pace lr-mono">
                                    {car.driverCode} {paceDelta < 0 ? "faster" : "slower"} by {Math.abs(paceDelta).toFixed(3)}s
                                </span>
                            )}
                        </div>

                        {car.currentTyre && ahead.currentTyre && (
                            <span className="lr-battle-tyres">
                                <span className={`lr-tyre lr-tyre--${ahead.currentTyre.toLowerCase()} lr-tyre--mini`}>{COMPOUND_LABELS[ahead.currentTyre] ?? ahead.currentTyre[0]}</span>
                                {ahead.tyreAge ?? "—"}L vs {car.tyreAge ?? "—"}L
                                <span className={`lr-tyre lr-tyre--${car.currentTyre.toLowerCase()} lr-tyre--mini`}>{COMPOUND_LABELS[car.currentTyre] ?? car.currentTyre[0]}</span>
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ── Gap to Leader — real gapToLeader values, dominant leader excluded
   from the parsed set (its own gap field is null by definition) and
   re-inserted as an explicit zero baseline so the bar order still reads
   as full running order. Cars showing "LAP n" (lapped) instead of a
   "+n.nnn" gap parse to null via parseGapSeconds and are simply left off
   the chart rather than plotted with an invented gap. Built with
   recharts, already a project dependency, rather than adding a new
   chart library. ────────────────────────────────────────────────── */

/* A thin stem + a small circular marker at the tip, drawn as one custom
   Bar `shape` rather than reaching for a second chart type — recharts
   hands the shape function the bar's own pixel geometry (x/y/width/
   height), so the stem is just a line from the axis origin to the
   bar's end and the marker is a circle at that same end point. The
   leader gets a slightly larger, outlined marker instead of a colour
   change — "highlighted", not re-themed. */
function LollipopShape(props) {
    const { x, y, width, height, payload } = props;
    const cy = y + height / 2;
    const tipX = x + width;
    const isLeader = payload.gap === 0;
    return (
        <g>
            <line x1={x} y1={cy} x2={tipX} y2={cy} stroke={payload.color} strokeWidth={2} strokeLinecap="round" />
            <circle
                cx={tipX}
                cy={cy}
                r={isLeader ? 6 : 4.5}
                fill={payload.color}
                stroke={isLeader ? "var(--text-primary)" : "none"}
                strokeWidth={isLeader ? 1.5 : 0}
            />
        </g>
    );
}

/* Shared by the live Gap to Leader chart and the post-race version
   below — same rows shape ({code, gap, color}), same lollipop
   rendering, just a different `leadLabel` ("LEADER" vs "WINNER") and
   empty-state copy, so there's exactly one lollipop implementation
   rather than two near-identical copies. */
function GapLollipopChart({ rows, leadLabel, EmptyIcon, emptyTitle, emptyDesc }) {
    if (rows.length === 0) {
        return (
            <div className="lr-compact-empty">
                <EmptyIcon size={18} aria-hidden="true" />
                <div className="lr-compact-empty-body">
                    <span className="lr-compact-empty-title">{emptyTitle}</span>
                    <span className="lr-compact-empty-desc">{emptyDesc}</span>
                </div>
            </div>
        );
    }

    const maxGap = Math.max(...rows.map((r) => r.gap));

    return (
        <div className="lr-bar-chart" style={{ height: rows.length * 22 + 28 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 48, bottom: 8, left: 0 }} barCategoryGap={3}>
                    <XAxis
                        type="number"
                        domain={[0, Math.max(1, maxGap * 1.08)]}
                        tickFormatter={(v) => `${v.toFixed(0)}s`}
                        tickLine={false}
                        axisLine={{ stroke: "var(--lr-border)" }}
                        tick={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--lr-text-secondary)" }}
                    />
                    <YAxis
                        type="category"
                        dataKey="code"
                        width={36}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--lr-text-secondary)" }}
                    />
                    <Bar dataKey="gap" shape={LollipopShape} barSize={14} isAnimationActive={false}>
                        <LabelList
                            dataKey="gap"
                            position="right"
                            formatter={(v) => (v === 0 ? leadLabel : `+${v.toFixed(3)}`)}
                            style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--lr-text-secondary)" }}
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

function GapToLeaderChart({ drivers }) {
    const rows = drivers
        .filter((d) => d.status === "racing" && d.position != null)
        .map((d) => ({
            code: d.driverCode ?? String(d.driverNumber),
            gap: d.position === 1 ? 0 : parseGapSeconds(d.gapToLeader),
            color: d.teamColor || "var(--border-strong)",
        }))
        .filter((r) => r.gap !== null)
        .sort((a, b) => a.gap - b.gap);

    return (
        <GapLollipopChart
            rows={rows}
            leadLabel="LEADER"
            EmptyIcon={BarChart2}
            emptyTitle="NO GAP DATA YET"
            emptyDesc="Gaps will appear once the leader has set a reference lap."
        />
    );
}

/* ── Post-race Gap to Leader — same lollipop, sourced from the
   completed race's real classification. A lapped-but-classified
   driver (status "+1 Lap") has no Time.time to parse into seconds —
   parseGapSeconds already returns null for anything that doesn't
   start with "+N.NNN", so those drivers (and retirees, who have
   neither) are correctly left off the chart rather than plotted with
   an invented gap. ─────────────────────────────────────────────────── */
function PostRaceGapChart({ latest }) {
    const results = latest?.Results ?? [];
    const rows = results
        .map((r) => {
            const isWinner = r.position === "1";
            const gap = isWinner ? 0 : parseGapSeconds(r.Time?.time);
            if (gap === null) return null;
            return {
                code: r.Driver.code ?? r.Driver.driverId,
                gap,
                color: getTeamAccent(r.Constructor.constructorId),
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.gap - b.gap);

    return (
        <GapLollipopChart
            rows={rows}
            leadLabel="WINNER"
            EmptyIcon={BarChart2}
            emptyTitle={latest?.resultsPending ? "CLASSIFICATION PENDING" : "NO GAP DATA"}
            emptyDesc={
                latest?.resultsPending
                    ? `${latest?.raceName ?? "This race"}'s results haven't posted yet.`
                    : "Timing gaps weren't recorded for this race."
            }
        />
    );
}

/* ── Post-race Weather — race-TIME conditions for the completed race,
   never the next GP's forecast and never "live" weather (there is no
   live session). See server/services/weatherService.js getRaceWeather:
   a single nearest-hour reading at the real race start (point), plus
   how many of the archive's hourly samples that fall within the race's
   own actual elapsed time (start -> start+winner's real race duration)
   were wet vs dry (condition) — a genuine, if sometimes coarse,
   real distribution, never invented percentages. Mirrors
   useWeatherForecast's shape/behavior exactly, just a different
   endpoint and no forecast-specific fields (precipitationProbability,
   forecastFor). ────────────────────────────────────────────────────── */
function useRaceWeather(lat, lon, startIso, durationMs) {
    const hasParams = lat != null && lon != null && Boolean(startIso);
    const key = `${lat}|${lon}|${startIso}|${durationMs}`;

    const [state, setState] = useState({ seenKey: key, status: hasParams ? "loading" : "unavailable", data: null });
    if (state.seenKey !== key) {
        setState({ seenKey: key, status: hasParams ? "loading" : "unavailable", data: null });
    }

    useEffect(() => {
        if (!hasParams) return undefined;
        let cancelled = false;

        const durationPart = durationMs != null ? `&durationMs=${durationMs}` : "";
        fetch(`${API}/weather/race?lat=${lat}&lon=${lon}&start=${encodeURIComponent(startIso)}${durationPart}`)
            .then((res) => (res.ok ? res.json() : { available: false }))
            .then((json) => {
                if (cancelled) return;
                setState((s) => ({ ...s, status: json?.available ? "ready" : "unavailable", data: json?.available ? json : null }));
            })
            .catch(() => {
                if (!cancelled) setState((s) => ({ ...s, status: "error", data: null }));
            });

        return () => {
            cancelled = true;
        };
    }, [lat, lon, startIso, durationMs, hasParams]);

    return state;
}

const CONDITION_SLICE_COLOR = { Dry: "var(--success)", Wet: "var(--accent)" };

function PostRaceWeatherSection({ latest }) {
    const location = latest?.Circuit?.Location;
    const lat = location?.lat != null ? Number(location.lat) : null;
    const lon = location?.long != null ? Number(location.long) : null;
    const startIso = latest?.date && latest?.time ? `${latest.date}T${latest.time}` : null;
    const winner = latest?.Results?.find((r) => r.position === "1");
    const durationMs = winner?.Time?.millis != null ? Number(winner.Time.millis) : null;

    const weather = useRaceWeather(lat, lon, startIso, durationMs);

    if (weather.status === "loading" || weather.status === "idle") {
        return <div className="lr-hub-loading">Loading race weather…</div>;
    }

    // "clearly show Race weather unavailable rather than using unrelated
    // or fabricated values" — exactly this, word for word, no fallback.
    if (weather.status !== "ready" || !weather.data) {
        return (
            <div className="lr-compact-empty">
                <Cloud size={18} aria-hidden="true" />
                <div className="lr-compact-empty-body">
                    <span className="lr-compact-empty-title">RACE WEATHER UNAVAILABLE</span>
                    <span className="lr-compact-empty-desc">Historical conditions couldn't be retrieved for this race.</span>
                </div>
            </div>
        );
    }

    const { point, condition } = weather.data;
    const slices = [
        condition?.drySamples > 0 && { name: "Dry", value: condition.drySamples },
        condition?.wetSamples > 0 && { name: "Wet", value: condition.wetSamples },
    ].filter(Boolean);
    const totalSamples = condition?.totalSamples ?? 0;

    const metrics = [
        point?.airTemperature != null && { icon: <Thermometer size={14} aria-hidden="true" />, label: "Air", value: `${Math.round(point.airTemperature)}°C` },
        point?.humidity != null && { icon: <Droplets size={14} aria-hidden="true" />, label: "Humidity", value: `${point.humidity}%` },
        point?.windSpeed != null && { icon: <Wind size={14} aria-hidden="true" />, label: "Wind", value: `${Math.round(point.windSpeed)} m/s` },
    ].filter(Boolean);

    if (!point && totalSamples === 0) {
        return (
            <div className="lr-compact-empty">
                <Cloud size={18} aria-hidden="true" />
                <div className="lr-compact-empty-body">
                    <span className="lr-compact-empty-title">RACE WEATHER UNAVAILABLE</span>
                    <span className="lr-compact-empty-desc">Historical conditions couldn't be retrieved for this race.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="lr-weather">
            {slices.length > 0 ? (
                <div className="lr-weather-donut">
                    <ResponsiveContainer width="100%" height={130}>
                        <PieChart>
                            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={2} isAnimationActive={false}>
                                {slices.map((s) => <Cell key={s.name} fill={CONDITION_SLICE_COLOR[s.name]} stroke="var(--lr-surface-card)" strokeWidth={2} />)}
                            </Pie>
                            <Tooltip content={<DonutTooltip unit="sample" />} />
                        </PieChart>
                    </ResponsiveContainer>
                    <ul className="lr-weather-donut-legend">
                        {slices.map((s) => (
                            <li key={s.name}>
                                <span className="lr-weather-donut-swatch" style={{ background: CONDITION_SLICE_COLOR[s.name] }} aria-hidden="true" />
                                {s.name} <b className="lr-mono">{Math.round((s.value / totalSamples) * 100)}%</b>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="lr-compact-empty lr-compact-empty--inline">
                    <CircleDashed size={16} aria-hidden="true" />
                    <span className="lr-compact-empty-desc">Not enough hourly samples for a condition breakdown.</span>
                </div>
            )}
            {metrics.length > 0 && (
                <div className="lr-weather-metrics">
                    {metrics.map((m) => (
                        <div className="lr-weather-metric" key={m.label}>
                            {m.icon}
                            <span className="lr-mono">{m.value}</span>
                            <small>{m.label}</small>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Post-race Team Position — a genuine lap-by-lap LINE chart, unlike
   the live dashboard's Team Position (which stays a current-position
   bar comparison because the live feed has no lap history at all —
   see TeamPerformanceSection's own comment). For a COMPLETED race,
   Jolpica's /laps.json genuinely has every driver's position after
   every lap (see server/controllers/grandprixController.js
   getRaceLaps) — real historical data, not generated. Defaults to the
   race-winning team so it opens on two readable lines; the selector
   switches which team's pair is plotted, same UX as the live Team
   Focus/Team Position filters. ───────────────────────────────────── */
function useRaceLaps(season, round) {
    const key = season && round ? `${season}:${round}` : null;

    // Reset synchronously during render when the race changes, same
    // pattern useWeatherForecast/useRaceWeather already use above —
    // the effect below only does the fetch, never an initial setState.
    const [state, setState] = useState({ key, status: key ? "loading" : "idle", laps: [] });
    if (state.key !== key) {
        setState({ key, status: key ? "loading" : "idle", laps: [] });
    }

    useEffect(() => {
        if (!key) return undefined;
        let cancelled = false;

        fetch(`${API}/grandprixdashboard/laps/${season}/${round}`)
            .then((res) => (res.ok ? res.json() : []))
            .then((laps) => {
                if (cancelled) return;
                setState({ key, status: Array.isArray(laps) && laps.length > 0 ? "ready" : "unavailable", laps: Array.isArray(laps) ? laps : [] });
            })
            .catch(() => {
                if (!cancelled) setState({ key, status: "error", laps: [] });
            });

        return () => {
            cancelled = true;
        };
    }, [key, season, round]);

    return state;
}

function PostRaceTeamPositionChart({ latest }) {
    const season = latest?.season;
    const round = latest?.round;
    const lapData = useRaceLaps(season, round);

    const driverMeta = new Map();
    for (const r of latest?.Results ?? []) {
        driverMeta.set(r.Driver.driverId, {
            code: r.Driver.code ?? r.Driver.driverId,
            team: r.Constructor.name,
            color: getTeamAccent(r.Constructor.constructorId),
        });
    }

    const teams = Array.from(new Set(Array.from(driverMeta.values()).map((m) => m.team))).sort();
    const winnerTeam = driverMeta.get(latest?.Results?.find((r) => r.position === "1")?.Driver.driverId)?.team;
    const [teamFilter, setTeamFilter] = useState(null);
    // Guards against a stale selection from a previous race (e.g. the
    // hub reloading for a new season) pointing at a team that no
    // longer exists in this race's field.
    const activeTeam = (teamFilter && teams.includes(teamFilter)) ? teamFilter : (winnerTeam ?? teams[0] ?? null);

    if (lapData.status === "loading" || lapData.status === "idle") {
        return <div className="lr-hub-loading">Loading lap-by-lap positions…</div>;
    }
    if (lapData.status !== "ready") {
        return (
            <div className="lr-compact-empty">
                <Shuffle size={18} aria-hidden="true" />
                <div className="lr-compact-empty-body">
                    <span className="lr-compact-empty-title">{latest?.resultsPending ? "LAP DATA PENDING" : "LAP HISTORY UNAVAILABLE"}</span>
                    <span className="lr-compact-empty-desc">
                        {latest?.resultsPending
                            ? `${latest?.raceName ?? "This race"}'s lap-by-lap data hasn't posted yet.`
                            : "Lap-by-lap positions couldn't be retrieved for this race."}
                    </span>
                </div>
            </div>
        );
    }

    const teamDriverIds = Array.from(driverMeta.entries())
        .filter(([, m]) => m.team === activeTeam)
        .map(([id]) => id);

    const fieldSize = driverMeta.size || 20;
    const chartRows = lapData.laps.map((l) => {
        const row = { lap: l.lap };
        for (const id of teamDriverIds) {
            const code = driverMeta.get(id)?.code;
            if (l.positions[id] != null) row[code] = l.positions[id];
        }
        return row;
    });

    return (
        <div className="lr-team-perf-wrap">
            <Select value={activeTeam ?? ""} onChange={(e) => setTeamFilter(e.target.value)} className="lr-team-select">
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <XAxis
                        dataKey="lap"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickLine={false}
                        axisLine={{ stroke: "var(--lr-border)" }}
                        tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--lr-text-secondary)" }}
                        label={{ value: "LAP", position: "insideBottomRight", offset: -4, fontSize: 9, fill: "var(--lr-text-secondary)" }}
                    />
                    <YAxis
                        type="number"
                        domain={[1, fieldSize]}
                        reversed
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        width={28}
                        tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--lr-text-secondary)" }}
                        tickFormatter={(v) => `P${v}`}
                    />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                                <div className="lr-donut-tooltip lr-mono">
                                    LAP {label}
                                    {payload.map((p) => (
                                        <div key={p.dataKey}>{p.dataKey}: P{p.value}</div>
                                    ))}
                                </div>
                            );
                        }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-mono)" }} />
                    {teamDriverIds.map((id, i) => {
                        const meta = driverMeta.get(id);
                        return (
                            <Line
                                key={id}
                                type="monotone"
                                dataKey={meta.code}
                                name={meta.code}
                                stroke={meta.color}
                                strokeWidth={2}
                                strokeDasharray={i === 1 ? "5 3" : undefined}
                                dot={false}
                                isAnimationActive={false}
                            />
                        );
                    })}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

/* ── Tyres & strategy ──────────────────────────────────────────────── */

function StintPips({ count }) {
    if (!count) return null;
    return (
        <span className="lr-stint-pips" aria-hidden="true">
            {Array.from({ length: count }).map((_, i) => (
                <span key={i} className={`lr-pip${i === count - 1 ? " lr-pip--current" : ""}`} />
            ))}
        </span>
    );
}

function TyreStrategySection({ drivers, sessionType }) {
    const withTyres = drivers.filter((d) => d.currentTyre);
    const showStops = isRaceLikeSession(sessionType);

    if (withTyres.length === 0) {
        // Drivers already being reported (position/name/team) means the
        // session genuinely is live — "once drivers are on track" would be
        // false in that case, so the copy only claims what's actually true.
        return drivers.length > 0 ? (
            <div className="lr-compact-empty">
                <CircleDashed size={18} aria-hidden="true" />
                <div className="lr-compact-empty-body">
                    <span className="lr-compact-empty-title">TYRE DATA NOT REPORTED</span>
                    <span className="lr-compact-empty-desc">Tyre information is not currently being reported for this session.</span>
                </div>
            </div>
        ) : (
            <EmptyState title="No tyre data yet" description="Stint and compound data will appear once drivers are on track." />
        );
    }
    const sorted = [...withTyres].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

    return (
        <div className="lr-timing-scroll lr-timing-scroll--capped">
            <table className="lr-timing">
                <thead>
                    <tr>
                        <th>Driver</th><th>Compound</th><th>Age</th><th>Stint</th>
                        {showStops && <th>Stops</th>}
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((d) => (
                        <tr key={d.driverNumber}>
                            <td className="lr-driver-code lr-mono">{d.driverCode ?? d.driverNumber}</td>
                            <td>
                                <span className={`lr-tyre lr-tyre--${d.currentTyre.toLowerCase()}`} title={d.currentTyre}>
                                    {COMPOUND_LABELS[d.currentTyre] ?? d.currentTyre[0]}
                                </span>
                            </td>
                            <td className="lr-mono">{d.tyreAge ?? "—"}</td>
                            <td className="lr-mono">
                                {d.stintNumber ?? "—"}
                                <StintPips count={d.stintNumber} />
                            </td>
                            {showStops && <td className="lr-mono">{d.pitStops}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ── Weather ───────────────────────────────────────────────────────── */

/* Air/track temperature, humidity and wind are single point-in-time
   readings (weather.timestamp is always null — no history is ever
   kept, see liveRaceService.js), so they're shown as compact icon
   metrics, never as a trend. There's no categorical weather field on
   the feed either (no "sunny/cloudy/overcast" enum to slice a donut
   by), so the donut doesn't touch temperature/humidity at all — it
   plots the one real categorical distribution this page already has:
   the field's current tyre-compound mix. Compound choice is a direct,
   real proxy for track conditions (wet tyres out = a wet track), which
   is exactly the "track-condition distribution from actual data"
   fallback this was built for, not a stand-in for the weather numbers
   themselves. */
const WEATHER_METRICS = [
    { key: "airTemperature", label: "Air", unit: "°C", Icon: Thermometer },
    { key: "trackTemperature", label: "Track", unit: "°C", Icon: Thermometer },
    { key: "humidity", label: "Humidity", unit: "%", Icon: Droplets },
    { key: "windSpeed", label: "Wind", unit: "m/s", Icon: Wind },
];

const COMPOUND_SLICE_COLOR = {
    SOFT: "var(--accent)",
    MEDIUM: "var(--warning)",
    HARD: "var(--color-cararra)",
    INTERMEDIATE: "var(--success)",
    WET: "var(--lr-text-secondary)",
};

/* Shared by the live tyre-compound donut and the post-race wet/dry
   donut — just a different unit noun ("car"/"sample"). */
function DonutTooltip({ active, payload, unit = "item" }) {
    if (!active || !payload?.length) return null;
    const p = payload[0];
    return (
        <div className="lr-donut-tooltip lr-mono">
            {p.name} — {p.value} {unit}{p.value === 1 ? "" : "s"}
        </div>
    );
}

function WeatherSection({ weather, drivers }) {
    if (!weather) {
        return <EmptyState title="No weather data" description="Live conditions will appear once the session reports them." />;
    }

    const metrics = WEATHER_METRICS.filter((m) => weather[m.key] != null);
    const isWet = weather.rainfall != null && weather.rainfall > 0;

    const compoundCounts = new Map();
    for (const d of drivers ?? []) {
        if (!d.currentTyre) continue;
        compoundCounts.set(d.currentTyre, (compoundCounts.get(d.currentTyre) ?? 0) + 1);
    }
    const totalWithTyres = Array.from(compoundCounts.values()).reduce((a, b) => a + b, 0);
    const slices = Array.from(compoundCounts.entries()).map(([compound, count]) => ({
        name: COMPOUND_LABELS[compound] ? `${compound[0]}${compound.slice(1).toLowerCase()}` : compound,
        value: count,
        pct: Math.round((count / totalWithTyres) * 100),
        fill: COMPOUND_SLICE_COLOR[compound] ?? "var(--lr-border)",
    }));

    return (
        <div className="lr-weather">
            {slices.length > 0 ? (
                <div className="lr-weather-donut">
                    <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                            <Pie
                                data={slices}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={42}
                                outerRadius={64}
                                paddingAngle={2}
                                isAnimationActive={false}
                            >
                                {slices.map((s) => <Cell key={s.name} fill={s.fill} stroke="var(--lr-surface-card)" strokeWidth={2} />)}
                            </Pie>
                            <Tooltip content={<DonutTooltip unit="car" />} />
                        </PieChart>
                    </ResponsiveContainer>
                    <ul className="lr-weather-donut-legend">
                        {slices.map((s) => (
                            <li key={s.name}>
                                <span className="lr-weather-donut-swatch" style={{ background: s.fill }} aria-hidden="true" />
                                {s.name} <b className="lr-mono">{s.pct}%</b>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="lr-compact-empty lr-compact-empty--inline">
                    <CircleDashed size={16} aria-hidden="true" />
                    <span className="lr-compact-empty-desc">No tyre data yet for a track-condition breakdown.</span>
                </div>
            )}

            <div className="lr-weather-metrics">
                {metrics.map((m) => (
                    <div className="lr-weather-metric" key={m.key}>
                        <m.Icon size={14} aria-hidden="true" />
                        <span className="lr-mono">{weather[m.key]}{m.unit}</span>
                        <small>{m.label}</small>
                    </div>
                ))}
                {weather.rainfall != null && (
                    <div className="lr-weather-metric">
                        <Droplets size={14} aria-hidden="true" />
                        <span className="lr-mono">{isWet ? "WET" : "DRY"}</span>
                        <small>Track</small>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Race control ──────────────────────────────────────────────────── */

/* Returns the icon + severity class together so the type label can be
   coloured to match the icon instead of only the icon itself standing
   out — see RaceControlSection below. */
function raceControlSeverity(type) {
    const t = (type || "").toUpperCase();
    if (t.includes("GREEN") || t.includes("CLEAR")) return { Icon: Flag, className: "lr-rc-icon--green" };
    if (t.includes("YELLOW")) return { Icon: Flag, className: "lr-rc-icon--yellow" };
    if (t.includes("RED")) return { Icon: Flag, className: "lr-rc-icon--red" };
    if (t.includes("SC") || t.includes("VSC") || t.includes("SAFETY")) return { Icon: ShieldAlert, className: "lr-rc-icon--orange" };
    if (t.includes("PENALTY") || t.includes("INCIDENT")) return { Icon: AlertTriangle, className: "lr-rc-icon--red" };
    return { Icon: AlertTriangle, className: "lr-rc-icon--neutral" };
}

function useNewestId(currentId) {
    const [state, setState] = useState({ prevId: currentId, isNew: false });
    if (state.prevId !== currentId) {
        setState({ prevId: currentId, isNew: state.prevId !== null });
    }
    return state.isNew;
}

function RaceControlSection({ events }) {
    const newestFirst = [...events].reverse();
    const topId = newestFirst[0]?.id ?? null;
    const isNew = useNewestId(topId);

    if (events.length === 0) {
        return (
            <div className="lr-compact-empty">
                <AlertTriangle size={18} aria-hidden="true" />
                <div className="lr-compact-empty-body">
                    <span className="lr-compact-empty-title">NO EVENTS YET</span>
                    <span className="lr-compact-empty-desc">Flags, penalties and incidents will appear here.</span>
                </div>
            </div>
        );
    }

    return (
        <ul className="lr-feed">
            {newestFirst.map((e, i) => {
                const t = (e.type || "").toUpperCase();
                const serious = t.includes("RED") || t.includes("SC") || t.includes("VSC") || t.includes("PENALTY") || t.includes("INCIDENT");
                const { Icon, className } = raceControlSeverity(e.type);
                return (
                    <li className={`lr-feed-item${i === 0 && isNew ? " lr-feed-item--new" : ""}${serious ? " lr-feed-item--serious" : ""}`} key={e.id}>
                        <Icon size={14} className={`lr-rc-icon ${className}`} aria-hidden="true" />
                        <div className="lr-feed-content">
                            <div className="lr-feed-headline">
                                <span className="lr-feed-time lr-mono">
                                    {e.timestamp ? new Date(`${e.timestamp}Z`).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                                </span>
                                {e.type && <b className={`lr-feed-type ${className}`}>{e.type.replace(/_/g, " ")}</b>}
                            </div>
                            <span className="lr-feed-body">{e.message}</span>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

/* ── Team radio ────────────────────────────────────────────────────── */

function formatClipDuration(seconds) {
    if (seconds == null || !Number.isFinite(seconds)) return null;
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/* A compact play/pause button + the clip's REAL duration, read off the
   audio element's own loaded metadata — never assumed. A clip whose
   URL 404s or never loads (a stale session path is the usual cause,
   see f1LiveTimingService.teamRadioUrl) falls back to the same
   "unavailable" state recordingUrl === null already uses, rather than
   sitting there as a native control stuck at a dead "0:00 / 0:00". */
function RadioClipPlayer({ src }) {
    const audioRef = useRef(null);
    const [state, setState] = useState("loading"); // loading | ready | error
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(null);

    const toggle = () => {
        const el = audioRef.current;
        if (!el) return;
        if (playing) el.pause();
        else el.play().catch(() => setState("error"));
    };

    if (state === "error") {
        return (
            <span className="lr-radio-unavailable">
                <RadioIcon size={12} aria-hidden="true" /> unavailable
            </span>
        );
    }

    return (
        <span className="lr-radio-player">
            <audio
                ref={audioRef}
                src={src}
                preload="metadata"
                onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (Number.isFinite(d) && d > 0) {
                        setDuration(d);
                        setState("ready");
                    } else {
                        setState("error");
                    }
                }}
                onError={() => setState("error")}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
            />
            <button
                type="button"
                className="lr-radio-play"
                onClick={toggle}
                disabled={state !== "ready"}
                aria-label={playing ? "Pause clip" : "Play clip"}
            >
                {playing ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
            </button>
            <span className="lr-mono lr-radio-duration">
                {state === "ready" ? formatClipDuration(duration) : "—:—"}
            </span>
        </span>
    );
}

function TeamRadioSection({ teamRadio, drivers }) {
    const [teamFilter, setTeamFilter] = useState("all");

    if (teamRadio.length === 0) {
        return (
            <div className="lr-compact-empty">
                <RadioIcon size={18} aria-hidden="true" />
                <div className="lr-compact-empty-body">
                    <span className="lr-compact-empty-title">NO RADIO YET</span>
                    <span className="lr-compact-empty-desc">Clips appear here as they're captured.</span>
                </div>
            </div>
        );
    }

    const teams = Array.from(new Set(teamRadio.map((r) => r.team).filter(Boolean))).sort();
    const newestFirst = [...teamRadio].reverse().filter((r) => teamFilter === "all" || r.team === teamFilter);

    return (
        <div className="lr-radio-wrap">
            <Select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="lr-team-select">
                <option value="all">All Teams</option>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>

            {newestFirst.length === 0 ? (
                <EmptyState title="No clips for this team" description="Switch teams or pick All Teams." />
            ) : (
                <ul className="lr-radio">
                    {newestFirst.map((r, i) => {
                        const driver = drivers.find((d) => d.driverNumber === r.driverNumber);
                        const time = r.timestamp
                            ? new Date(r.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
                            : "—";
                        return (
                            <li className="lr-radio-item" key={`${r.driverNumber}-${r.timestamp}-${i}`}>
                                <span className="lr-mono lr-radio-time">{time}</span>
                                <DriverAvatar code={driver?.driverCode ?? (r.driverNumber ? String(r.driverNumber) : "?")} color={driver?.teamColor} size="sm" />
                                <span className="lr-radio-driver" title={driver?.name ?? r.team ?? ""}>{driver?.driverCode ?? (r.driverNumber ? `#${r.driverNumber}` : "?")}</span>
                                <span className="lr-radio-team" title={r.team ?? ""}>{r.team ?? "—"}</span>
                                {r.recordingUrl ? (
                                    <RadioClipPlayer src={r.recordingUrl} />
                                ) : (
                                    <span className="lr-radio-unavailable">
                                        <RadioIcon size={12} aria-hidden="true" /> unavailable
                                    </span>
                                )}
                                {i === 0 && <span className="lr-radio-new">NEW</span>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/* ── Section shell ─────────────────────────────────────────────────── */

function Panel({ title, className = "", children }) {
    return (
        <section className={`lr-panel ${className}`}>
            <h2 className="lr-panel-title">{title}</h2>
            {children}
        </section>
    );
}

/* ── Page ──────────────────────────────────────────────────────────── */

function DashboardSkeleton() {
    return (
        <div className="lr">
            <div className="lr-skel lr-skel-header" />
            <main className="lr-main">
                <div className="lr-skel lr-skel-panel" style={{ height: 76 }} />
                <div className="lr-grid lr-grid--primary">
                    <div className="lr-skel lr-skel-panel" style={{ height: 420 }} />
                    <div className="lr-skel lr-skel-panel" style={{ height: 420 }} />
                </div>
                {[180, 260, 280, 220].map((height, i) => (
                    <div className="lr-grid lr-grid--6-6" key={i}>
                        <div className="lr-skel lr-skel-panel" style={{ height }} />
                        <div className="lr-skel lr-skel-panel" style={{ height }} />
                    </div>
                ))}
            </main>
        </div>
    );
}

function LiveRace() {
    const { data, error, loading, retry } = useLiveRace();

    if (loading) {
        return <DashboardSkeleton />;
    }

    if (error && !data) {
        return (
            <div className="lr">
                <main className="lr-main">
                    <EmptyState
                        title="Live data unavailable"
                        description="Unable to connect to the live timing service. Check that the server is running and try again."
                        action={<Button variant="secondary" onClick={retry}>Retry</Button>}
                    />
                </main>
            </div>
        );
    }

    if (!data || !data.race) {
        return (
            <div className="lr">
                <CompactHeader data={{ isLive: false, race: null, updatedAt: data?.updatedAt }} />
                <main className="lr-main">
                    <EmptyState title="No race is currently scheduled" description="Check back closer to the next Grand Prix weekend." />
                </main>
            </div>
        );
    }

    if (!data.isLive) {
        return (
            <div className="lr">
                <CompactHeader data={data} />
                <main className="lr-main">
                    <NonLiveHub race={data.race} />
                </main>
            </div>
        );
    }

    if (data.dataStatus === "unavailable") {
        return (
            <div className="lr">
                <CompactHeader data={data} />
                <main className="lr-main">
                    <EmptyState
                        title="No live data yet"
                        description="A session is live, but the timing feed hasn't reported driver data yet. This updates automatically."
                    />
                </main>
            </div>
        );
    }

    const drivers = data.drivers ?? [];
    const sessionType = data.race?.session;
    const tyresTitle = isRaceLikeSession(sessionType) ? "Tyres & Strategy" : "Tyres";

    return (
        <div className="lr">
            <CompactHeader data={data} />
            <main className="lr-main">
                <SessionKpiStrip data={data} drivers={drivers} />

                <div className="lr-grid lr-grid--primary">
                    <Panel title={<><Timer size={13} aria-hidden="true" />Live Timing</>} className="lr-panel--primary">
                        <LiveTimingTable drivers={drivers} sessionType={sessionType} />
                    </Panel>
                    <Panel title={<><Swords size={13} aria-hidden="true" />Battles</>} className="lr-panel--battles">
                        <BattlesSection drivers={drivers} />
                    </Panel>
                </div>

                {/* A deliberate mosaic — four stacked, self-contained rows,
                   each pairing modules of intentionally similar natural
                   height (KPI-style panels together, both graphs together,
                   both capped/scrollable feeds together). Each row is its
                   own grid, so one row's height never carries over into
                   the next the way a single multi-row grid would. */}
                <div className="lr-grid lr-grid--6-6">
                    <Panel title={<><Users size={13} aria-hidden="true" />Team Focus</>}>
                        <TeamFocus drivers={drivers} season={data.race?.season} />
                    </Panel>
                    <Panel title={<><Signal size={13} aria-hidden="true" />Session Pulse</>}>
                        <SessionPulsePanel data={data} drivers={drivers} />
                    </Panel>
                </div>

                <div className="lr-grid lr-grid--6-6">
                    <Panel title={<><BarChart2 size={13} aria-hidden="true" />Gap to Leader</>}>
                        <GapToLeaderChart drivers={drivers} />
                    </Panel>
                    <Panel title={<><Shuffle size={13} aria-hidden="true" />Team Position</>}>
                        <TeamPerformanceSection drivers={drivers} currentLap={data.race?.currentLap} />
                    </Panel>
                </div>

                <div className="lr-grid lr-grid--6-6">
                    <Panel title={<><CircleDashed size={13} aria-hidden="true" />{tyresTitle}</>}>
                        <TyreStrategySection drivers={drivers} sessionType={sessionType} />
                    </Panel>
                    <Panel title={<><AlertTriangle size={13} aria-hidden="true" />Race Control</>}>
                        <RaceControlSection events={data.events ?? []} />
                    </Panel>
                </div>

                <div className="lr-grid lr-grid--6-6">
                    <Panel title={<><Cloud size={13} aria-hidden="true" />Weather</>}>
                        <WeatherSection weather={data.weather} drivers={drivers} />
                    </Panel>
                    <Panel title={<><RadioIcon size={13} aria-hidden="true" />Team Radio</>}>
                        <TeamRadioSection teamRadio={data.teamRadio ?? []} drivers={drivers} />
                    </Panel>
                </div>
            </main>
        </div>
    );
}

export default LiveRace;
