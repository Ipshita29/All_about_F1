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
import { Flag, AlertTriangle, Radio as RadioIcon, Thermometer, Droplets, Wind, Users, Signal, Swords, Timer } from "lucide-react";
import { EmptyState, Select, Button } from "../components/UI";
import "../styles/pages/LiveRace.css";

const API = "http://localhost:3000";
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

function formatCountdown(targetIso) {
    if (!targetIso) return null;
    const diffMs = new Date(targetIso).getTime() - Date.now();
    if (Number.isNaN(diffMs) || diffMs <= 0) return null;
    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days > 0) parts.push(`${String(days).padStart(2, "0")}d`);
    if (days > 0 || hours > 0) parts.push(`${String(hours).padStart(2, "0")}h`);
    parts.push(`${String(minutes).padStart(2, "0")}m`);
    return parts.join(" ");
}

/* Recomputed every 30s rather than every second — a countdown that's a
   little stale for a few seconds is fine; a page that re-renders every
   second for an idle empty state is not. */
function useCountdown(targetIso) {
    const [state, setState] = useState({ seenIso: targetIso, label: formatCountdown(targetIso) });

    if (state.seenIso !== targetIso) {
        setState({ seenIso: targetIso, label: formatCountdown(targetIso) });
    }

    useEffect(() => {
        if (!targetIso) return undefined;
        const id = setInterval(() => {
            setState((s) => ({ ...s, label: formatCountdown(targetIso) }));
        }, 30000);
        return () => clearInterval(id);
    }, [targetIso]);

    return state.label;
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

/* ── Compact header ────────────────────────────────────────────────── */

function CompactHeader({ data }) {
    const race = data.race;
    const isLive = data.isLive;
    const weather = data.weather;

    return (
        <header className="lr-header">
            <div className="lr-header-row">
                <span className={`lr-badge${isLive ? " lr-badge--live" : ""}`}>
                    <span className="lr-badge-dot" aria-hidden="true" />
                    {isLive ? "LIVE" : "NEXT SESSION"}
                </span>
                <div className="lr-header-id">
                    <span className="lr-header-title">{race?.grandPrix ?? "No Session Scheduled"}</span>
                    {race?.circuit && <span className="lr-header-loc">{race.circuit}{race.country ? `, ${race.country}` : ""}</span>}
                </div>
            </div>
            <div className="lr-header-meta">
                {race?.session && <span className="lr-meta-item lr-mono">{sessionShortLabel(race.session)}</span>}
                {isLive && data.track?.status && (
                    <span className="lr-meta-item">
                        <span className={`lr-flag-dot lr-flag-dot--${data.track.status.toLowerCase()}`} aria-hidden="true" />
                        {formatFlag(data.track.status)}
                    </span>
                )}
                {isLive && weather?.airTemperature != null && (
                    <span className="lr-meta-item lr-mono">{weather.airTemperature}°C</span>
                )}
                {!isLive && race?.startTime && (
                    <span className="lr-meta-item lr-mono">
                        {new Date(race.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                )}
                {data.updatedAt && <span className="lr-meta-item lr-meta-item--faint lr-mono">UPDATED {timeAgo(data.updatedAt).toUpperCase()}</span>}
            </div>
        </header>
    );
}

/* ── Next-session panel (isLive === false) ────────────────────────── */

function NextSessionPanel({ race, message }) {
    const countdown = useCountdown(race?.startTime);

    if (!race?.grandPrix) {
        return <EmptyState title="No live session right now" description={message ?? "No F1 session is currently live."} />;
    }

    return (
        <div className="lr-panel lr-next-session">
            <span className="lr-panel-title">Next Session</span>
            <div className="lr-next-session-id">
                <span className="lr-next-session-gp">{race.grandPrix}</span>
                {race.circuit && <span className="lr-next-session-loc">{race.circuit}{race.country ? `, ${race.country}` : ""}</span>}
            </div>
            {(race.session || countdown || race.startTime) && (
                <div className="lr-next-session-meta">
                    {race.session && <span className="lr-meta-item lr-mono">{sessionShortLabel(race.session)}</span>}
                    {countdown && <span className="lr-next-session-countdown lr-mono">{countdown}</span>}
                    {race.startTime && (
                        <span className="lr-meta-item lr-meta-item--faint lr-mono">
                            Scheduled {new Date(race.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                    )}
                </div>
            )}

            <div className="lr-next-session-divider" />

            <div className="lr-compact-empty">
                <span className="lr-compact-empty-title">NO LIVE SESSION RIGHT NOW</span>
                <span className="lr-compact-empty-desc">
                    No F1 session is currently live. The live timing dashboard will activate automatically when the next session begins.
                </span>
            </div>
        </div>
    );
}

/* ── Live timing (dominant section) ───────────────────────────────── */

function LiveTimingTable({ drivers }) {
    const flashKeys = useFlashTracker(drivers);

    if (drivers.length === 0) {
        return <EmptyState title="No timing data yet" description="Driver timing will appear as soon as the session reports it." />;
    }
    const sorted = [...drivers].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

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
                        <th>Stops</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((d) => (
                        <tr key={d.driverNumber} className={d.status !== "racing" ? `lr-row-${d.status}` : ""}>
                            {cell(d.driverNumber, "position", d.position, "lr-timing-pos")}
                            <td>
                                <span className="lr-driver-chip">
                                    <span className="lr-team-dot" style={{ background: d.teamColor ?? "var(--border-strong)" }} aria-hidden="true" />
                                    <span className="lr-driver-code lr-mono">{d.driverCode ?? d.driverNumber}</span>
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
                            <td className="lr-mono">{d.pitStops}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ── Session pulse ─────────────────────────────────────────────────── */

function SessionPulse({ data, drivers }) {
    const weatherSummary = data.weather
        ? `${data.weather.airTemperature ?? "—"}°C${data.weather.rainfall > 0 ? " · Rain" : " · Dry"}`
        : "—";

    const fastest = drivers
        .map((d) => ({ d, secs: parseLapTime(d.bestLap) }))
        .filter((x) => x.secs !== null)
        .sort((a, b) => a.secs - b.secs)[0];

    const totalPitStops = drivers.reduce((sum, d) => sum + (d.pitStops || 0), 0);

    const rows = [
        [<Signal size={14} aria-hidden="true" />, "Connection", data.provider ? `Live · ${data.dataStatus}` : "Schedule only"],
        [<Flag size={14} aria-hidden="true" />, "Track Status", data.track?.status ? formatFlag(data.track.status) : "—"],
        [<Users size={14} aria-hidden="true" />, "Drivers Reporting", drivers.length || "—"],
        [<Timer size={14} aria-hidden="true" />, "Fastest Lap", fastest ? `${fastest.d.driverCode} · ${fastest.d.bestLap}` : "—"],
        [<Thermometer size={14} aria-hidden="true" />, "Weather", weatherSummary],
        [<AlertTriangle size={14} aria-hidden="true" />, "Pit Stops", totalPitStops || "—"],
        [<AlertTriangle size={14} aria-hidden="true" />, "Race Control Events", data.events?.length ?? 0],
    ];

    return (
        <dl className="lr-pulse">
            {rows.map(([icon, label, value]) => (
                <div className="lr-pulse-row" key={label}>
                    <dt>{icon}{label}</dt>
                    <dd className="lr-mono">{value}</dd>
                </div>
            ))}
        </dl>
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

    return (
        <div className="lr-team-focus">
            <Select value={activeTeam ?? ""} onChange={(e) => setSelected(e.target.value)} className="lr-team-select">
                {teams.map(([team]) => <option key={team} value={team}>{team}</option>)}
            </Select>
            {teamDrivers.length === 0 ? (
                <EmptyState title="No drivers reporting" description="This team has no live data yet." />
            ) : (
                <div className="lr-team-compare" style={{ "--lr-team-cols": teamDrivers.length }}>
                    <div className="lr-team-compare-row lr-team-compare-head">
                        {teamDrivers.map((d) => (
                            <div className="lr-team-compare-driver" key={d.driverNumber}>
                                <span className="lr-team-dot" style={{ background: d.teamColor ?? "var(--border-strong)" }} aria-hidden="true" />
                                <span className="lr-driver-code lr-mono">{d.driverCode ?? d.driverNumber}</span>
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
            )}
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
                <span className="lr-compact-empty-title">NO ACTIVE BATTLES</span>
                <span className="lr-compact-empty-desc">No drivers currently within 1 second.</span>
            </div>
        );
    }

    return (
        <div className="lr-battles-list">
            {battles.map(({ car, ahead, gap }) => (
                <div className="lr-battle-card" key={car.driverNumber}>
                    <span className="lr-battle-heading">BATTLE FOR P{car.position}</span>

                    <div className="lr-battle-side">
                        <span className="lr-team-dot" style={{ background: ahead.teamColor ?? "var(--border-strong)" }} aria-hidden="true" />
                        <div className="lr-battle-side-id">
                            <span className="lr-battle-side-name">{ahead.name ?? ahead.driverCode}</span>
                            <span className="lr-battle-side-team">{ahead.team ?? "—"}</span>
                        </div>
                        <span className="lr-mono lr-battle-side-pos">P{ahead.position}</span>
                    </div>

                    <div className="lr-battle-foot">
                        <Swords size={11} className="lr-battle-icon" aria-hidden="true" />
                        <span className="lr-battle-gap lr-mono">{gap.toFixed(3)}s</span>
                        {gap < 0.3 && <span className="lr-battle-tag">CLOSE FIGHT</span>}
                    </div>

                    <div className="lr-battle-side">
                        <span className="lr-team-dot" style={{ background: car.teamColor ?? "var(--border-strong)" }} aria-hidden="true" />
                        <div className="lr-battle-side-id">
                            <span className="lr-battle-side-name">{car.name ?? car.driverCode}</span>
                            <span className="lr-battle-side-team">{car.team ?? "—"}</span>
                        </div>
                        <span className="lr-mono lr-battle-side-pos">P{car.position}</span>
                    </div>

                    {car.currentTyre && ahead.currentTyre && car.currentTyre !== ahead.currentTyre && (
                        <span className="lr-battle-tyres">{ahead.currentTyre} — {ahead.tyreAge ?? "—"} laps vs {car.currentTyre} — {car.tyreAge ?? "—"} laps</span>
                    )}
                </div>
            ))}
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

function TyreStrategySection({ drivers }) {
    const withTyres = drivers.filter((d) => d.currentTyre);
    if (withTyres.length === 0) {
        return <EmptyState title="No tyre data yet" description="Stint and compound data will appear once drivers are on track." />;
    }
    const sorted = [...withTyres].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

    return (
        <div className="lr-timing-scroll">
            <table className="lr-timing">
                <thead>
                    <tr><th>Driver</th><th>Compound</th><th>Age</th><th>Stint</th><th>Stops</th></tr>
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
                            <td className="lr-mono">{d.pitStops}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ── Weather ───────────────────────────────────────────────────────── */

function WeatherSection({ weather }) {
    if (!weather) {
        return <EmptyState title="No weather data" description="Live conditions will appear once the session reports them." />;
    }
    const rows = [
        [<Thermometer size={14} aria-hidden="true" />, "Air Temp", weather.airTemperature != null ? `${weather.airTemperature}°C` : null],
        [<Thermometer size={14} aria-hidden="true" />, "Track Temp", weather.trackTemperature != null ? `${weather.trackTemperature}°C` : null],
        [<Droplets size={14} aria-hidden="true" />, "Humidity", weather.humidity != null ? `${weather.humidity}%` : null],
        [<Wind size={14} aria-hidden="true" />, "Wind", weather.windSpeed != null ? `${weather.windSpeed} m/s${weather.windDirection != null ? ` @ ${weather.windDirection}°` : ""}` : null],
        [<Droplets size={14} aria-hidden="true" />, "Rainfall", weather.rainfall != null ? (weather.rainfall > 0 ? "Rain" : "Dry") : null],
    ].filter(([, , v]) => v !== null);

    return (
        <dl className="lr-pulse">
            {rows.map(([icon, label, value]) => (
                <div className="lr-pulse-row" key={label}>
                    <dt>{icon}{label}</dt>
                    <dd className="lr-mono">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

/* ── Race control ──────────────────────────────────────────────────── */

function raceControlIcon(type) {
    const t = (type || "").toUpperCase();
    if (t.includes("GREEN") || t.includes("CLEAR")) return <Flag size={13} className="lr-rc-icon lr-rc-icon--green" aria-hidden="true" />;
    if (t.includes("YELLOW")) return <Flag size={13} className="lr-rc-icon lr-rc-icon--yellow" aria-hidden="true" />;
    if (t.includes("RED")) return <Flag size={13} className="lr-rc-icon lr-rc-icon--red" aria-hidden="true" />;
    return <AlertTriangle size={13} className="lr-rc-icon lr-rc-icon--neutral" aria-hidden="true" />;
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
                <span className="lr-compact-empty-title">NO EVENTS YET</span>
                <span className="lr-compact-empty-desc">Flags, penalties and incidents will appear here.</span>
            </div>
        );
    }

    return (
        <ul className="lr-feed">
            {newestFirst.map((e, i) => (
                <li className={`lr-feed-item${i === 0 && isNew ? " lr-feed-item--new" : ""}`} key={e.id}>
                    {raceControlIcon(e.type)}
                    <span className="lr-feed-time lr-mono">
                        {e.timestamp ? new Date(`${e.timestamp}Z`).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                    </span>
                    <span className="lr-feed-body">
                        {e.type && <b>{e.type.replace(/_/g, " ")}</b>} {e.message}
                    </span>
                </li>
            ))}
        </ul>
    );
}

/* ── Team radio ────────────────────────────────────────────────────── */

function TeamRadioSection({ teamRadio, drivers }) {
    if (teamRadio.length === 0) {
        return (
            <div className="lr-compact-empty">
                <span className="lr-compact-empty-title">NO RADIO YET</span>
                <span className="lr-compact-empty-desc">Clips appear here as they're captured.</span>
            </div>
        );
    }
    const newestFirst = [...teamRadio].reverse();
    return (
        <ul className="lr-radio">
            {newestFirst.map((r, i) => {
                const driver = drivers.find((d) => d.driverNumber === r.driverNumber);
                return (
                    <li className="lr-radio-item" key={`${r.driverNumber}-${r.timestamp}-${i}`}>
                        <div className="lr-radio-meta">
                            <RadioIcon size={13} aria-hidden="true" />
                            <span className="lr-radio-driver">{driver?.name ?? (r.driverNumber ? `#${r.driverNumber}` : "Unknown")}</span>
                            <span className="lr-radio-team">{r.team ?? ""}</span>
                            {i === 0 && <span className="lr-radio-new">NEW</span>}
                        </div>
                        {r.recordingUrl ? (
                            <audio controls preload="none" src={r.recordingUrl} className="lr-radio-player" />
                        ) : (
                            <span className="lr-radio-unavailable">Recording unavailable</span>
                        )}
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
                <div className="lr-grid lr-grid--primary">
                    <div className="lr-skel lr-skel-panel" style={{ height: 420 }} />
                    <div className="lr-skel lr-skel-panel" style={{ height: 420 }} />
                </div>
                <div className="lr-grid lr-grid--triple">
                    <div className="lr-skel lr-skel-panel" style={{ height: 200 }} />
                    <div className="lr-skel lr-skel-panel" style={{ height: 200 }} />
                    <div className="lr-skel lr-skel-panel" style={{ height: 200 }} />
                </div>
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
                    <NextSessionPanel race={data.race} message={data.message} />
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

    return (
        <div className="lr">
            <CompactHeader data={data} />
            <main className="lr-main">
                <div className="lr-grid lr-grid--primary">
                    <Panel title="Live Timing" className="lr-panel--primary">
                        <LiveTimingTable drivers={drivers} />
                    </Panel>
                    <Panel title="Battles" className="lr-panel--battles">
                        <BattlesSection drivers={drivers} />
                    </Panel>
                </div>

                <div className="lr-grid lr-grid--triple">
                    <Panel title="Session Pulse">
                        <SessionPulse data={data} drivers={drivers} />
                    </Panel>
                    <Panel title="Team Focus">
                        <TeamFocus drivers={drivers} season={data.race?.season} />
                    </Panel>
                    <Panel title="Tyres & Strategy">
                        <TyreStrategySection drivers={drivers} />
                    </Panel>
                </div>

                <div className="lr-grid lr-grid--events">
                    <Panel title="Race Control">
                        <RaceControlSection events={data.events ?? []} />
                    </Panel>
                    <Panel title="Weather">
                        <WeatherSection weather={data.weather} />
                    </Panel>
                </div>

                <Panel title="Team Radio" className="lr-panel--full">
                    <TeamRadioSection teamRadio={data.teamRadio ?? []} drivers={drivers} />
                </Panel>
            </main>
        </div>
    );
}

export default LiveRace;
