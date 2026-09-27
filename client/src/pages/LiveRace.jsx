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
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList } from "recharts";
import {
    Flag, AlertTriangle, Radio as RadioIcon, Thermometer, Droplets, Wind, Users, Signal, Swords, Timer,
    MapPin, Calendar, Trophy, Wrench, UserRound, Cloud,
    CircleDashed, Sun, CloudSun, Cloudy, CloudFog, CloudDrizzle, CloudRain, CloudSnow,
    CloudLightning, ShieldAlert, BarChart2, Gauge, Shuffle,
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
function useRaceHubData(season) {
    const [state, setState] = useState({ loading: true, error: false, season: null, schedule: [], latest: null });

    // Reset to loading synchronously during render when season changes,
    // rather than as the first act of the effect below.
    if (season && state.season !== season && !state.loading) {
        setState((s) => ({ ...s, loading: true, error: false }));
    }

    useEffect(() => {
        if (!season) return undefined;
        let cancelled = false;

        const getJson = (path, fallback) =>
            fetch(`${API}${path}`).then((r) => (r.ok ? r.json() : fallback)).catch(() => fallback);

        Promise.all([
            getJson(`/grandprixdashboard/${season}`, []),
            getJson("/grandprixdashboard/latest", null),
        ])
            .then(([schedule, latest]) => {
                if (cancelled) return;
                setState({ loading: false, error: false, season, schedule, latest });
            })
            .catch(() => {
                if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
            });

        return () => {
            cancelled = true;
        };
    }, [season]);

    return state;
}


/* ── 4. Next Race Context ─────────────────────────────────────────── */

function NextRaceContext({ hub, race }) {
    if (hub.loading) return <div className="lr-hub-loading">Loading…</div>;
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

/* ── Previous Grand Prix — Netflix-style driver results carousel ─────
   Full classified order from the most recently completed race (real
   Jolpica Results, never trimmed to a podium), one card per driver.
   Hover/focus scales the centred card up and nudges it into view —
   plain CSS transform + transition driven by which index is active,
   no carousel dependency. ─────────────────────────────────────────── */

function driverResultLine(result, isWinner) {
    if (isWinner) return { value: result.Time?.time ?? "—", label: "Race Winner" };
    if (result.status === "Finished" && result.Time?.time) return { value: result.Time.time, label: "Gap" };
    if (typeof result.status === "string" && result.status.startsWith("+")) return { value: result.status, label: "Gap" };
    return { value: result.status || "—", label: "Status" };
}

function PreviousGpCard({ result, isWinner, isActive, onActivate, onDeactivate }) {
    const fullName = `${result.Driver.givenName} ${result.Driver.familyName}`;
    const accent = getTeamAccent(result.Constructor.constructorId);
    const line = driverResultLine(result, isWinner);

    return (
        <div
            className={`lr-gp-card${isActive ? " lr-gp-card--active" : ""}`}
            style={{ "--lr-gp-accent": accent }}
            tabIndex={0}
            onMouseEnter={onActivate}
            onMouseLeave={onDeactivate}
            onFocus={onActivate}
            onBlur={onDeactivate}
        >
            <DriverPortrait
                driverId={result.Driver.driverId}
                fullName={fullName}
                frameClassName="lr-gp-card-photo"
                fallbackClassName="lr-driver-card-photo-fallback"
                fallbackIcon={<UserRound size={28} aria-hidden="true" />}
            />
            <div className="lr-gp-card-body">
                <span className="lr-mono lr-gp-card-pos">{isWinner && <Trophy size={12} aria-hidden="true" />}P{result.position}</span>
                <span className="lr-gp-card-name">{fullName}</span>
                <span className="lr-gp-card-team">{result.Constructor.name}</span>
                <span className="lr-mono lr-gp-card-line">{line.value}<small>{line.label}</small></span>
            </div>
        </div>
    );
}

function PreviousGrandPrix({ hub }) {
    const [activeId, setActiveId] = useState(null);

    if (hub.loading) return <div className="lr-hub-loading">Loading previous results…</div>;
    const latest = hub.latest;
    if (!latest?.Results?.length) {
        return <EmptyState title="No completed races yet" description="Results will appear here once a Grand Prix has been completed." onLight />;
    }

    const activate = (id) => (e) => {
        setActiveId(id);
        e.currentTarget.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" });
    };

    return (
        <div className="lr-gp">
            <div className="lr-gp-head">
                <span className="lr-gp-name">{latest.raceName}</span>
                <span className="lr-gp-meta">
                    <MapPin size={12} aria-hidden="true" />
                    {latest.Circuit?.circuitName}{latest.Circuit?.Location?.country ? `, ${latest.Circuit.Location.country}` : ""}
                    <span className="lr-mono">{formatDate(latest.date)}</span>
                </span>
            </div>
            <div className="lr-gp-track">
                {latest.Results.map((r) => (
                    <PreviousGpCard
                        key={r.Driver.driverId}
                        result={r}
                        isWinner={r.position === "1"}
                        isActive={activeId === r.Driver.driverId}
                        onActivate={activate(r.Driver.driverId)}
                        onDeactivate={() => setActiveId(null)}
                    />
                ))}
            </div>
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

function NonLiveHub({ race }) {
    const hub = useRaceHubData(race?.season);

    return (
        <div className="lr-hub">
            <NoSessionBanner />

            <Panel title={<><Flag size={13} aria-hidden="true" />Previous Grand Prix</>} className="lr-panel--full lr-panel--chalk">
                <PreviousGrandPrix hub={hub} />
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

/* ── Team focus ────────────────────────────────────────────────────── */

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
   by team and ordered by each team's best-placed car. Bar length is a
   simple inverse-of-position read (P1 = full bar) so the field's shape
   is visible at a glance; the "TeamName P1 · P9" pairing from the brief
   is the pos label printed at the end of each bar. ───────────────────── */

function TeamPerformanceSection({ drivers }) {
    const fieldSize = drivers.length || 20;

    const byTeam = new Map();
    for (const d of drivers) {
        if (!d.team || d.position == null) continue;
        if (!byTeam.has(d.team)) byTeam.set(d.team, { color: d.teamColor, drivers: [] });
        byTeam.get(d.team).drivers.push(d);
    }

    const teams = Array.from(byTeam.entries())
        .map(([team, v]) => ({ team, color: v.color, drivers: v.drivers.sort((a, b) => a.position - b.position) }))
        .sort((a, b) => a.drivers[0].position - b.drivers[0].position);

    if (teams.length === 0) {
        return <EmptyState title="No positions yet" description="Team performance will appear once drivers are classified." />;
    }

    return (
        <div className="lr-team-perf">
            {teams.map((t) => (
                <div className="lr-team-perf-row" key={t.team}>
                    <span className="lr-team-perf-name">{t.team}</span>
                    <div className="lr-team-perf-bars">
                        {t.drivers.map((d) => (
                            <span className="lr-team-perf-bar-wrap" key={d.driverNumber} title={`${d.driverCode ?? d.driverNumber} P${d.position}`}>
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

    if (rows.length === 0) {
        return (
            <div className="lr-compact-empty">
                <BarChart2 size={18} aria-hidden="true" />
                <div className="lr-compact-empty-body">
                    <span className="lr-compact-empty-title">NO GAP DATA YET</span>
                    <span className="lr-compact-empty-desc">Gaps will appear once the leader has set a reference lap.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="lr-bar-chart" style={{ height: rows.length * 22 + 4 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap={3}>
                    <XAxis type="number" hide />
                    <YAxis
                        type="category"
                        dataKey="code"
                        width={36}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--lr-text-secondary)" }}
                    />
                    <Bar dataKey="gap" radius={[0, 3, 3, 0]} barSize={11} isAnimationActive={false}>
                        {rows.map((r) => <Cell key={r.code} fill={r.color} />)}
                        <LabelList
                            dataKey="gap"
                            position="right"
                            formatter={(v) => (v === 0 ? "LEADER" : `+${v.toFixed(3)}`)}
                            style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--lr-text-secondary)" }}
                        />
                    </Bar>
                </BarChart>
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

/* Current-snapshot indicator bars, not a time-series graph — the live
   feed's weather.timestamp is always null (no history is ever kept, see
   liveRaceService.js), so a trend line would have to be invented. These
   bars only ever encode the single latest reading against a fixed,
   sensible scale for that metric. */
const WEATHER_METRICS = [
    { key: "airTemperature", label: "Air Temp", unit: "°C", Icon: Thermometer, max: 45 },
    { key: "trackTemperature", label: "Track Temp", unit: "°C", Icon: Thermometer, max: 60 },
    { key: "humidity", label: "Humidity", unit: "%", Icon: Droplets, max: 100 },
    { key: "windSpeed", label: "Wind", unit: " m/s", Icon: Wind, max: 15 },
];

function WeatherSection({ weather }) {
    if (!weather) {
        return <EmptyState title="No weather data" description="Live conditions will appear once the session reports them." />;
    }

    const rows = WEATHER_METRICS
        .filter((m) => weather[m.key] != null)
        .map((m) => ({ ...m, value: weather[m.key], pct: Math.max(2, Math.min(100, (weather[m.key] / m.max) * 100)) }));

    const isWet = weather.rainfall != null && weather.rainfall > 0;

    return (
        <div className="lr-weather-bars">
            {rows.map((m) => (
                <div className="lr-weather-row" key={m.key}>
                    <span className="lr-weather-label"><m.Icon size={13} aria-hidden="true" />{m.label}</span>
                    <span className="lr-weather-track"><span className="lr-weather-fill" style={{ width: `${m.pct}%` }} /></span>
                    <span className="lr-mono lr-weather-value">{m.value}{m.unit}</span>
                </div>
            ))}
            {weather.rainfall != null && (
                <div className="lr-weather-row">
                    <span className="lr-weather-label"><Droplets size={13} aria-hidden="true" />Track</span>
                    <span className="lr-weather-track">
                        <span className={`lr-weather-fill${isWet ? " lr-weather-fill--wet" : " lr-weather-fill--dry"}`} style={{ width: isWet ? "100%" : "10%" }} />
                    </span>
                    <span className="lr-mono lr-weather-value">{isWet ? "RAIN" : "DRY"}</span>
                </div>
            )}
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

function TeamRadioSection({ teamRadio, drivers }) {
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
    const newestFirst = [...teamRadio].reverse();
    return (
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
                        <span className="lr-radio-line" aria-hidden="true" />
                        {r.recordingUrl ? (
                            <audio controls preload="none" src={r.recordingUrl} className="lr-radio-player" />
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
                        <TeamPerformanceSection drivers={drivers} />
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
                        <WeatherSection weather={data.weather} />
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
