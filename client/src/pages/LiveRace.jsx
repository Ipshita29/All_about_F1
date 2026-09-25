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
import { getTeamAccent } from "../config/driverAssets";
import { positionsGained } from "../utils/landingHelpers";
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

/* ═══════════════════════════════════════════════════════════════════
   RACE HUB — the isLive === false experience. Not an empty state: a
   full between-race dashboard built entirely from data the backend
   already exposes (Jolpica schedule/results/standings/pitstops, the
   existing News integration). One-time fetch on entry, not polled —
   this content doesn't change second to second the way live timing
   does. Every section that depends on data the current APIs don't
   provide (tyre compounds in pit-stop history, weather forecasts, AI
   previews) says so explicitly rather than inventing it.
   ═══════════════════════════════════════════════════════════════════ */

function formatDate(dateStr, timeStr) {
    if (!dateStr) return null;
    const d = new Date(timeStr ? `${dateStr}T${timeStr}` : dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", ...(timeStr ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

function useRaceHubData(season) {
    const [state, setState] = useState({
        loading: true, error: false, season: null,
        schedule: [], latest: null, driverStandings: [], constructorStandings: [],
        qualifying: [], pitStops: [], recentRaces: [], news: [],
    });

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

        (async () => {
            try {
                const [schedule, latest, driverStandings, constructorStandings, news] = await Promise.all([
                    getJson(`/grandprixdashboard/${season}`, []),
                    getJson("/grandprixdashboard/latest", null),
                    getJson(`/drivers/standings/${season}`, []),
                    getJson(`/teams/standings/${season}`, []),
                    getJson("/news", []),
                ]);

                let qualifying = [];
                let pitStops = [];
                let recentRaces = [];

                if (latest?.round && latest?.season) {
                    const lastRound = Number(latest.round);
                    const rounds = [];
                    for (let r = Math.max(1, lastRound - 4); r <= lastRound; r++) rounds.push(r);

                    const [qualRes, pitRes, recentRes] = await Promise.all([
                        getJson(`/grandprixdashboard/qualifying/${latest.season}/${lastRound}`, []),
                        getJson(`/grandprixdashboard/pitstops/${latest.season}/${lastRound}`, []),
                        Promise.all(rounds.map((r) => getJson(`/grandprixdashboard/results/${latest.season}/${r}`, []).then((results) => ({ round: r, results })))),
                    ]);
                    qualifying = qualRes;
                    pitStops = pitRes;
                    recentRaces = recentRes;
                }

                if (cancelled) return;
                setState({ loading: false, error: false, season, schedule, latest, driverStandings, constructorStandings, qualifying, pitStops, recentRaces, news });
            } catch {
                if (!cancelled) setState((s) => ({ ...s, loading: false, error: true }));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [season]);

    return state;
}

/* ── 1. Header — next session identity + countdown ────────────────── */

function RaceHubHeader({ race }) {
    const countdown = useCountdown(race?.startTime);

    if (!race?.grandPrix) {
        return <EmptyState title="No live session right now" description="No F1 session is currently live." />;
    }

    return (
        <div className="lr-panel lr-next-session">
            <span className="lr-panel-title">Next Session</span>
            <div className="lr-next-session-id">
                <span className="lr-next-session-gp">{race.grandPrix}</span>
                {race.circuit && <span className="lr-next-session-loc">{race.circuit}{race.country ? `, ${race.country}` : ""}</span>}
            </div>
            <div className="lr-next-session-meta">
                {race.session && <span className="lr-meta-item lr-mono">{sessionShortLabel(race.session)}</span>}
                {race.startTime && (
                    <span className="lr-meta-item lr-mono">
                        {new Date(race.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                )}
                {countdown && <span className="lr-next-session-countdown lr-mono">{countdown}</span>}
                <span className="lr-meta-item lr-meta-item--faint">NO LIVE SESSION RIGHT NOW</span>
            </div>
        </div>
    );
}

/* ── 2/3. Team Focus (season-long) + Recent Driver Form share a team
   selection so "form" is scoped to whoever's focused ── */

function useTeamOptions(constructorStandings) {
    return useMemo(
        () => constructorStandings.map((s) => ({
            id: s.Constructor.constructorId,
            name: s.Constructor.name,
            color: getTeamAccent(s.Constructor.constructorId),
            position: s.position,
            points: s.points,
        })),
        [constructorStandings]
    );
}

function TeamFocusHub({ hub, selectedTeamId, onSelectTeam, teams }) {
    if (hub.loading) return <div className="lr-hub-loading">Loading…</div>;
    if (teams.length === 0) return <EmptyState title="Standings unavailable" description="Team standings couldn't be loaded." />;

    const lastResults = hub.latest?.Results ?? [];
    const qualByDriver = new Map(hub.qualifying.map((q) => [q.Driver.driverId, q.position]));

    const teamDrivers = hub.driverStandings.filter((s) => s.Constructors?.[0]?.constructorId === selectedTeamId);

    return (
        <div className="lr-team-focus">
            <Select value={selectedTeamId ?? "all"} onChange={(e) => onSelectTeam(e.target.value)} className="lr-team-select">
                <option value="all">All Teams</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>

            {selectedTeamId === "all" || !selectedTeamId ? (
                <div className="lr-hub-all-teams">
                    <span className="lr-hub-all-teams-label">Constructors' Championship</span>
                    {teams.slice(0, 5).map((t) => (
                        <div className="lr-standings-row" key={t.id}>
                            <span className="lr-mono lr-standings-pos">P{t.position}</span>
                            <span className="lr-team-dot" style={{ background: t.color }} aria-hidden="true" />
                            <span className="lr-standings-name">{t.name}</span>
                            <span className="lr-mono lr-standings-points">{t.points} PTS</span>
                        </div>
                    ))}
                </div>
            ) : teamDrivers.length === 0 ? (
                <EmptyState title="No drivers found" description="This team has no standings entry this season." />
            ) : (
                <div className="lr-hub-drivers">
                    {teamDrivers.map((s) => {
                        const lastResult = lastResults.find((r) => r.Driver.driverId === s.Driver.driverId);
                        const qualPos = qualByDriver.get(s.Driver.driverId);
                        return (
                            <div className="lr-hub-driver-card" key={s.Driver.driverId}>
                                <span className="lr-hub-driver-name">{s.Driver.givenName} {s.Driver.familyName}</span>
                                <div className="lr-hub-driver-stats">
                                    <span><b>P{s.position}</b><small>Championship</small></span>
                                    <span><b>{s.points}</b><small>Points</small></span>
                                    <span><b>{lastResult ? `P${lastResult.position}` : "—"}</b><small>Last Race</small></span>
                                    <span><b>{qualPos ? `P${qualPos}` : "—"}</b><small>Last Qualifying</small></span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function RecentDriverForm({ hub, selectedTeamId }) {
    if (hub.loading) return <div className="lr-hub-loading">Loading…</div>;
    if (!selectedTeamId || selectedTeamId === "all") {
        return <EmptyState title="Select a team" description="Choose a team in Team Focus to see recent driver form." />;
    }

    const teamDrivers = hub.driverStandings.filter((s) => s.Constructors?.[0]?.constructorId === selectedTeamId);
    if (teamDrivers.length === 0 || hub.recentRaces.length === 0) {
        return <EmptyState title="No recent form data" description="Recent race history isn't available yet." />;
    }

    return (
        <div className="lr-form-list">
            {teamDrivers.map((s) => {
                const rows = hub.recentRaces
                    .map((race) => ({ round: race.round, result: race.results.find((r) => r.Driver.driverId === s.Driver.driverId) }))
                    .filter((row) => row.result);
                const positions = rows.map((row) => Number(row.result.position)).filter((n) => !Number.isNaN(n));
                const avg = positions.length ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1) : null;

                return (
                    <div className="lr-form-driver" key={s.Driver.driverId}>
                        <div className="lr-form-head">
                            <span className="lr-form-name">{s.Driver.familyName}</span>
                            {avg && <span className="lr-mono lr-form-avg">AVG P{avg}</span>}
                        </div>
                        <div className="lr-form-chips">
                            {rows.length === 0 ? (
                                <span className="lr-compact-empty-desc">No recent race results found.</span>
                            ) : rows.map((row) => (
                                <span className="lr-form-chip lr-mono" key={row.round} title={`Round ${row.round}`}>P{row.result.position}</span>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
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

/* ── 5. Next Race Weather — no forecast provider exists; say so ──────── */

function NextRaceWeatherForecast() {
    return (
        <div className="lr-compact-empty">
            <span className="lr-compact-empty-title">FORECAST UNAVAILABLE</span>
            <span className="lr-compact-empty-desc">Weather forecast data will appear here when a forecast provider is integrated. Live conditions appear on this page once the session goes live.</span>
        </div>
    );
}

/* ── 6. Last Grand Prix summary ───────────────────────────────────── */

const NON_FINISH_CODES = new Set(["R", "D", "W", "N", "E"]);
const NON_FINISH_LABELS = { R: "Retired", D: "DSQ", W: "DNS", N: "Not Classified", E: "Excluded" };

function computeRaceHighlights(latest, pitStops) {
    const results = latest.Results || [];

    let biggestGain = null;
    let biggestLoss = null;
    for (const r of results) {
        const gain = positionsGained(r);
        if (gain === null) continue;
        if (gain > 0 && (!biggestGain || gain > positionsGained(biggestGain))) biggestGain = r;
        if (gain < 0 && (!biggestLoss || gain < positionsGained(biggestLoss))) biggestLoss = r;
    }

    const nonFinishers = results.filter((r) => NON_FINISH_CODES.has(r.positionText));

    return {
        biggestGain,
        biggestLoss,
        nonFinishers,
        classifiedCount: results.length - nonFinishers.length,
        totalEntrants: results.length,
        totalPitStops: pitStops.length,
    };
}

function LastGrandPrixSummary({ hub }) {
    if (hub.loading) return <div className="lr-hub-loading">Loading…</div>;
    const latest = hub.latest;
    if (!latest?.Results?.length) return <EmptyState title="No completed races yet" description="Race results will appear here once a Grand Prix has been completed." />;

    const podium = latest.Results.slice(0, 3);
    const fastestLap = latest.Results.find((r) => r.FastestLap?.rank === "1");
    const highlights = computeRaceHighlights(latest, hub.pitStops);

    const items = [
        highlights.biggestGain && {
            label: "Biggest Gain", driver: highlights.biggestGain.Driver,
            value: `+${positionsGained(highlights.biggestGain)} positions`, sub: `P${highlights.biggestGain.grid} → P${highlights.biggestGain.position}`,
        },
        highlights.biggestLoss && {
            label: "Biggest Loss", driver: highlights.biggestLoss.Driver,
            value: `${positionsGained(highlights.biggestLoss)} positions`, sub: `P${highlights.biggestLoss.grid} → P${highlights.biggestLoss.position}`,
        },
        highlights.totalPitStops > 0 && {
            label: "Pit Stops", driver: null,
            value: highlights.totalPitStops, sub: "across the field",
        },
        {
            label: "Classified", driver: null,
            value: `${highlights.classifiedCount} / ${highlights.totalEntrants}`, sub: "finishers",
        },
    ].filter(Boolean);

    return (
        <div className="lr-lastgp">
            <div className="lr-lastgp-head">
                <span className="lr-lastgp-name">{latest.raceName}</span>
                <span className="lr-lastgp-round lr-mono">ROUND {latest.round}</span>
            </div>
            <div className="lr-lastgp-podium">
                {podium.map((r, i) => (
                    <div className="lr-lastgp-pos" key={r.Driver.driverId}>
                        <span className="lr-mono lr-lastgp-p">P{i + 1}</span>
                        <span className="lr-lastgp-driver">{r.Driver.givenName} {r.Driver.familyName}</span>
                        <span className="lr-lastgp-team">{r.Constructor.name}</span>
                    </div>
                ))}
                {fastestLap && (
                    <div className="lr-lastgp-pos">
                        <span className="lr-mono lr-lastgp-p">FL</span>
                        <span className="lr-lastgp-driver">{fastestLap.Driver.givenName} {fastestLap.Driver.familyName}</span>
                        <span className="lr-lastgp-team lr-mono">{fastestLap.FastestLap.Time.time}</span>
                    </div>
                )}
            </div>
            <div className="lr-next-session-divider" />
            <div className="lr-lastgp-highlights">
                <span className="lr-panel-title">Key Highlights</span>
                <div className="lr-highlight-grid">
                    {items.map((item) => (
                        <div className="lr-highlight-item" key={item.label}>
                            <span className="lr-highlight-label">{item.label}</span>
                            {item.driver && <span className="lr-highlight-driver">{item.driver.givenName} {item.driver.familyName}</span>}
                            <span className="lr-mono lr-highlight-value">{item.value}</span>
                            <span className="lr-highlight-sub">{item.sub}</span>
                        </div>
                    ))}
                </div>
                {highlights.nonFinishers.length > 0 && (
                    <p className="lr-highlight-dnf">
                        <span className="lr-highlight-label">Did Not Finish</span>{" "}
                        {highlights.nonFinishers.map((r) => `${r.Driver.familyName} (${NON_FINISH_LABELS[r.positionText] ?? r.positionText})`).join(", ")}
                    </p>
                )}
                <Button variant="secondary" size="sm" to={`/grandprixdashboard/${latest.season}/${latest.round}`} arrow>
                    View Full Race Results
                </Button>
            </div>
        </div>
    );
}

/* ── 7. Last race strategy — pit-lap/stop-count only; Jolpica has no
   tyre-compound history, so compounds are never shown or implied ──── */

function LastRaceStrategy({ hub }) {
    if (hub.loading) return <div className="lr-hub-loading">Loading…</div>;
    const latest = hub.latest;
    if (!latest?.Results?.length || hub.pitStops.length === 0) {
        return <EmptyState title="Strategy data unavailable" description="Pit-stop data for the last race couldn't be loaded." />;
    }

    const stopsByDriver = new Map();
    for (const stop of hub.pitStops) {
        if (!stopsByDriver.has(stop.driverId)) stopsByDriver.set(stop.driverId, []);
        stopsByDriver.get(stop.driverId).push(stop);
    }

    const distribution = new Map();
    for (const r of latest.Results) {
        const count = (stopsByDriver.get(r.Driver.driverId) || []).length;
        distribution.set(count, (distribution.get(count) || 0) + 1);
    }

    const podiumStrategies = latest.Results.slice(0, 3).map((r) => ({
        driver: r.Driver,
        stops: (stopsByDriver.get(r.Driver.driverId) || []).sort((a, b) => Number(a.lap) - Number(b.lap)),
    }));

    return (
        <div className="lr-strategy">
            <span className="lr-panel-title">Strategy Distribution</span>
            <div className="lr-strategy-distribution">
                {Array.from(distribution.entries()).sort((a, b) => a[0] - b[0]).map(([stops, count]) => (
                    <span className="lr-strategy-tag lr-mono" key={stops}>{stops}-STOP · {count} DRIVERS</span>
                ))}
            </div>

            <span className="lr-panel-title lr-strategy-subtitle">Strategy Comparison — Podium</span>
            <div className="lr-strategy-podium">
                {podiumStrategies.map(({ driver, stops }) => (
                    <div className="lr-strategy-row" key={driver.driverId}>
                        <span className="lr-strategy-driver">{driver.familyName}</span>
                        <span className="lr-mono lr-strategy-laps">
                            {stops.length === 0 ? "No stops" : stops.map((s) => `Lap ${s.lap}`).join(" · ")}
                        </span>
                    </div>
                ))}
            </div>
            <p className="lr-compact-empty-desc lr-strategy-note">Pit lap and stop count are from real race data. Tyre compound history isn't available from the current data source.</p>
        </div>
    );
}

/* ── 9. What To Watch — AI integration boundary, no fake content ─────── */

function WhatToWatch({ race }) {
    return (
        <div className="lr-watch">
            <p className="lr-watch-copy">
                AI-generated storylines, form trends and strategy previews for {race?.grandPrix ?? "the next race"} will appear here in a future Race Intelligence phase.
            </p>
            <Button variant="secondary" disabled aria-disabled="true">Generate Full Race Preview — Coming Soon</Button>
        </div>
    );
}

/* ── 10. Championship snapshot ─────────────────────────────────────── */

function ChampionshipSnapshot({ hub }) {
    if (hub.loading) return <div className="lr-hub-loading">Loading…</div>;
    if (hub.driverStandings.length === 0 && hub.constructorStandings.length === 0) {
        return <EmptyState title="Standings unavailable" description="Championship standings couldn't be loaded." />;
    }

    return (
        <div className="lr-championship">
            <span className="lr-panel-title">Drivers</span>
            {hub.driverStandings.slice(0, 6).map((s) => (
                <div className="lr-standings-row" key={s.Driver.driverId}>
                    <span className="lr-mono lr-standings-pos">P{s.position}</span>
                    <span className="lr-standings-name">{s.Driver.givenName} {s.Driver.familyName}</span>
                    <span className="lr-standings-team">{s.Constructors?.[0]?.name ?? ""}</span>
                    <span className="lr-mono lr-standings-points">{s.points}</span>
                </div>
            ))}
            <span className="lr-panel-title lr-strategy-subtitle">Constructors</span>
            {hub.constructorStandings.slice(0, 6).map((s) => (
                <div className="lr-standings-row" key={s.Constructor.constructorId}>
                    <span className="lr-mono lr-standings-pos">P{s.position}</span>
                    <span className="lr-team-dot" style={{ background: getTeamAccent(s.Constructor.constructorId) }} aria-hidden="true" />
                    <span className="lr-standings-name">{s.Constructor.name}</span>
                    <span className="lr-mono lr-standings-points">{s.points}</span>
                </div>
            ))}
        </div>
    );
}

/* ── 11. Latest F1 updates — reuses the existing News integration ────── */

function LatestF1Updates({ hub }) {
    if (hub.loading) return <div className="lr-hub-loading">Loading…</div>;
    if (hub.news.length === 0) return <EmptyState title="No updates available" description="Couldn't load the latest F1 news right now." />;

    return (
        <ul className="lr-news-list">
            {hub.news.slice(0, 6).map((item) => (
                <li className="lr-news-item" key={item.id}>
                    <a href={item.url} target="_blank" rel="noreferrer" className="lr-news-title">{item.title}</a>
                    <span className="lr-news-meta">{item.source}{item.publishedAt ? ` · ${timeAgo(item.publishedAt)}` : ""}</span>
                </li>
            ))}
        </ul>
    );
}

/* ── Race Hub orchestrator ─────────────────────────────────────────── */

function RaceHub({ race }) {
    const hub = useRaceHubData(race?.season);
    const teams = useTeamOptions(hub.constructorStandings);
    const [selectedTeamId, setSelectedTeamId] = useState(null);

    if (!race?.grandPrix) {
        return <RaceHubHeader race={race} />;
    }

    return (
        <div className="lr-hub">
            <RaceHubHeader race={race} />

            <div className="lr-grid lr-grid--split">
                <Panel title="Team Focus">
                    <TeamFocusHub hub={hub} selectedTeamId={selectedTeamId} onSelectTeam={setSelectedTeamId} teams={teams} />
                </Panel>
                <div className="lr-hub-stack">
                    <Panel title="Next Race Context">
                        <NextRaceContext hub={hub} race={race} />
                    </Panel>
                    <Panel title="Next Race Weather">
                        <NextRaceWeatherForecast />
                    </Panel>
                </div>
            </div>

            <Panel title="Last Grand Prix" className="lr-panel--full">
                <LastGrandPrixSummary hub={hub} />
            </Panel>

            <div className="lr-grid lr-grid--split">
                <Panel title="Last Race Strategy">
                    <LastRaceStrategy hub={hub} />
                </Panel>
                <Panel title="Recent Driver Form">
                    <RecentDriverForm hub={hub} selectedTeamId={selectedTeamId} />
                </Panel>
            </div>

            <Panel title="What To Watch" className="lr-panel--full">
                <WhatToWatch race={race} />
            </Panel>

            <div className="lr-grid lr-grid--split">
                <Panel title="Championship Snapshot">
                    <ChampionshipSnapshot hub={hub} />
                </Panel>
                <Panel title="Latest F1 Updates">
                    <LatestF1Updates hub={hub} />
                </Panel>
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
                    <RaceHub race={data.race} />
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
