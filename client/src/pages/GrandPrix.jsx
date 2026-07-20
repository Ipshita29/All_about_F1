/*
 * RACE WEEKEND — the championship season as a journey.
 *
 * Instead of a calendar of identical cards, the season is a route travelled
 * top-to-bottom: completed Grands Prix are stamped checkpoints (hover loads
 * and reveals the podium + fastest lap lazily from the existing results
 * endpoint), the current weekend is a large cinematic focus module with
 * countdown / session / championship progress / circuit blueprint, and
 * future races are destinations whose blueprint + schedule unfold on hover.
 * Clicking a checkpoint flies into Grand Prix Details via a shared-element
 * view transition. Same backend endpoints as before; year select and search
 * are preserved.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import useCountdown from "../hooks/useCountdown";
import useInViewOnce from "../hooks/useInViewOnce";
import { circuitInfo } from "../data/circuitInfo";
import { formatSessionTime } from "../utils/timeUtils";
import {
    getWeekendSessions,
    formatWeekendRange,
    circuitMapSrc,
} from "../utils/landingHelpers";
import "./RaceWeekend.css";

const API = "http://localhost:3000";
const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

function pad(n) {
    return String(n).padStart(2, "0");
}

function raceStart(race) {
    if (!race?.date) return null;
    return race.time
        ? new Date(`${race.date}T${race.time}`)
        : new Date(`${race.date}T00:00:00`);
}

/* Dashed blueprint outline drawn when no circuit map asset exists */
function BlueprintFallback() {
    return (
        <svg viewBox="0 0 300 180" className="rw-blueprint-fallback" aria-hidden="true">
            <path
                d="M40 140 L60 60 Q64 44 80 44 L150 50 Q170 52 180 38 Q188 26 204 30
                   L250 44 Q266 49 260 66 L236 120 Q230 136 214 136 L70 152
                   Q48 154 40 140 Z"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="6 8"
            />
        </svg>
    );
}

function CircuitMap({ circuitId, alt }) {
    const [failed, setFailed] = useState(false);
    const src = circuitMapSrc(circuitId);
    if (!src || failed) return <BlueprintFallback />;
    return (
        <img
            src={src}
            alt={alt}
            loading="lazy"
            className="rw-circuit-img"
            onError={() => setFailed(true)}
        />
    );
}

/* ── Season focus module: the current / next race weekend ─────────── */

function FocusModule({ race, year, isLive, liveLabel, doneCount, totalCount }) {
    const sessions = getWeekendSessions(race);
    const raceSession = sessions.find((s) => s.key === "Race");
    const countdown = useCountdown(raceSession?.start || null);
    const [ref, inView] = useInViewOnce({ threshold: 0.2 });

    const now = new Date();
    const nextUp = sessions.find((s) => s.start > now);
    const circuit = circuitInfo[race.Circuit?.circuitId];
    const conditions = circuit?.weatherImpact
        ? `${circuit.weatherImpact.split(". ")[0]}.`
        : null;
    const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    return (
        <section
            ref={ref}
            className={`rw-focus${inView ? " rw-focus--lit" : ""}${isLive ? " rw-focus--live" : ""}`}
            aria-label="Current race weekend"
        >
            <div className="rw-focus-glow" aria-hidden="true" />

            <div className="rw-focus-head">
                <span className="rw-focus-status rw-mono">
                    <span className="rw-focus-dot" aria-hidden="true" />
                    {isLive ? `LIVE — ${liveLabel}` : "NEXT DESTINATION"}
                </span>
                <span className="rw-focus-round rw-mono">
                    ROUND {race.round} / {totalCount}
                </span>
            </div>

            <div className="rw-focus-body">
                <div className="rw-focus-info">
                    <h2 className="rw-focus-title">{race.raceName}</h2>
                    <p className="rw-focus-meta rw-mono">
                        {race.Circuit?.circuitName?.toUpperCase()} ·{" "}
                        {race.Circuit?.Location?.locality?.toUpperCase()},{" "}
                        {race.Circuit?.Location?.country?.toUpperCase()} ·{" "}
                        {formatWeekendRange(race)}
                    </p>

                    {raceSession && countdown.total > 0 && (
                        <div
                            className="rw-focus-countdown rw-mono"
                            role="timer"
                            aria-label={`Race starts in ${countdown.days} days ${countdown.hours} hours ${countdown.minutes} minutes ${countdown.seconds} seconds`}
                        >
                            {[
                                [countdown.days, "DAYS"],
                                [countdown.hours, "HRS"],
                                [countdown.minutes, "MIN"],
                                [countdown.seconds, "SEC"],
                            ].map(([val, lbl]) => (
                                <span className="rw-count-unit" key={lbl}>
                                    <b>{pad(val)}</b>
                                    <small>{lbl}</small>
                                </span>
                            ))}
                        </div>
                    )}

                    {nextUp && (
                        <p className="rw-focus-session">
                            <span className="rw-mono rw-focus-session-label">
                                {isLive ? "CURRENT / NEXT SESSION" : "NEXT SESSION"}
                            </span>
                            {nextUp.label} — {formatSessionTime(nextUp.date, nextUp.time)}
                        </p>
                    )}

                    <div className="rw-focus-progress">
                        <span className="rw-mono rw-focus-progress-label">
                            CHAMPIONSHIP PROGRESS — {doneCount} OF {totalCount} ROUNDS COMPLETE
                        </span>
                        <div className="rw-progress-track">
                            <div className="rw-progress-fill" style={{ width: `${progress}%` }} />
                            <div className="rw-progress-marker" style={{ left: `${progress}%` }} />
                        </div>
                    </div>

                    {conditions && (
                        <p className="rw-focus-weather">
                            <span className="rw-mono rw-focus-session-label">CONDITIONS BRIEF</span>
                            {conditions}
                        </p>
                    )}

                    <Link
                        to={`/grandprixdashboard/${year}/${race.round}`}
                        className="rw-cta"
                        viewTransition
                    >
                        ENTER RACE HQ <span aria-hidden="true">→</span>
                    </Link>
                </div>

                <div className="rw-focus-map" aria-hidden="true">
                    <CircuitMap
                        circuitId={race.Circuit?.circuitId}
                        alt={`${race.Circuit?.circuitName} layout`}
                    />
                    <span className="rw-focus-map-label rw-mono">
                        CIRCUIT BLUEPRINT — {race.Circuit?.circuitId?.toUpperCase()}
                    </span>
                </div>
            </div>
        </section>
    );
}

/* ── Hover reveal for a completed checkpoint: podium + fastest lap ── */

function PodiumPeek({ results }) {
    if (results === null) {
        return <p className="rw-peek-loading rw-mono">RETRIEVING CLASSIFICATION…</p>;
    }
    if (!results || results.length === 0) {
        return <p className="rw-peek-loading rw-mono">NO CLASSIFICATION AVAILABLE</p>;
    }
    const fastest = results.find((r) => r.FastestLap?.rank === "1");
    return (
        <div className="rw-peek-results">
            {results.slice(0, 3).map((r, i) => (
                <div className={`rw-peek-row rw-peek-row--p${i + 1}`} key={r.position}>
                    <span className="rw-peek-pos rw-mono">P{r.position}</span>
                    <span className="rw-peek-name">
                        {r.Driver.givenName} {r.Driver.familyName}
                    </span>
                    <span className="rw-peek-team">{r.Constructor.name}</span>
                </div>
            ))}
            {fastest && (
                <div className="rw-peek-flap">
                    <span className="rw-peek-pos rw-mono rw-peek-flap-icon">FL</span>
                    <span className="rw-peek-name">
                        {fastest.Driver.givenName} {fastest.Driver.familyName}
                    </span>
                    <span className="rw-peek-team rw-mono">
                        {fastest.FastestLap.Time?.time}
                    </span>
                </div>
            )}
        </div>
    );
}

/* ── Hover reveal for a future destination: blueprint + schedule ──── */

function DestinationPeek({ race }) {
    const sessions = getWeekendSessions(race);
    const raceSession = sessions.find((s) => s.key === "Race");
    const countdown = useCountdown(raceSession?.start || null);

    return (
        <div className="rw-peek-future">
            <div className="rw-peek-map">
                <CircuitMap
                    circuitId={race.Circuit?.circuitId}
                    alt={`${race.Circuit?.circuitName} layout`}
                />
            </div>
            <ul className="rw-peek-sessions">
                {sessions.map((s) => (
                    <li key={s.key}>
                        <span>{s.label}</span>
                        <span className="rw-mono">{formatSessionTime(s.date, s.time)}</span>
                    </li>
                ))}
            </ul>
            {countdown.total > 0 && (
                <p className="rw-peek-countdown rw-mono">
                    LIGHTS OUT IN {countdown.days}D {pad(countdown.hours)}H {pad(countdown.minutes)}M
                </p>
            )}
        </div>
    );
}

/* ── One checkpoint on the season route ───────────────────────────── */

function Checkpoint({ race, state, year, index, results, winner, onPeek }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.18 });
    const side = index % 2 === 0 ? "left" : "right";
    const hasSprint = Boolean(race.Sprint);

    const stateLabel =
        state === "done" ? "FINISHED" : state === "focus" ? "YOU ARE HERE" : "AWAITS";

    return (
        <li
            ref={ref}
            className={`rw-stop rw-stop--${side} rw-stop--${state}${inView ? " rw-stop--in" : ""}`}
        >
            <span className="rw-stop-marker" aria-hidden="true">
                <b className="rw-mono">{pad(Number(race.round))}</b>
            </span>

            <Link
                to={`/grandprixdashboard/${year}/${race.round}`}
                className="rw-stop-card"
                viewTransition
                onMouseEnter={state === "done" ? onPeek : undefined}
                onFocus={state === "done" ? onPeek : undefined}
            >
                <div className="rw-stop-top rw-mono">
                    <span className="rw-stop-round">ROUND {race.round}</span>
                    <span className="rw-stop-badges">
                        {hasSprint && <span className="rw-badge rw-badge--sprint">SPRINT</span>}
                        <span className={`rw-badge rw-badge--${state}`}>{stateLabel}</span>
                    </span>
                </div>

                <h3
                    className="rw-stop-name"
                    style={{ viewTransitionName: `gp-title-${year}-${race.round}` }}
                >
                    {race.raceName}
                </h3>
                <p className="rw-stop-circuit">{race.Circuit?.circuitName}</p>
                <p className="rw-stop-meta rw-mono">
                    {race.Circuit?.Location?.country?.toUpperCase()} · {formatWeekendRange(race)}
                </p>

                {state === "done" && winner && (
                    <p className="rw-stop-winner">
                        <span className="rw-stop-winner-stamp rw-mono">WINNER</span>
                        {winner}
                    </p>
                )}

                {/* layered hover reveal */}
                <div className="rw-stop-peek" aria-hidden="true">
                    {state === "done" && <PodiumPeek results={results} />}
                    {state === "future" && <DestinationPeek race={race} />}
                    {state === "focus" && (
                        <p className="rw-peek-loading rw-mono">OPEN RACE HQ FOR THE FULL BRIEFING →</p>
                    )}
                </div>
            </Link>
        </li>
    );
}

/* ── Page ──────────────────────────────────────────────────────────── */

function GrandPrix() {
    const [grandprix, setGrandprix] = useState([]);
    const [loadedYear, setLoadedYear] = useState(null);
    const [year, setYear] = useState("2026");
    const [search, setSearch] = useState("");
    const [resultsCache, setResultsCache] = useState({});
    const [minuteTick, setMinuteTick] = useState(0);

    useEffect(() => {
        fetch(`${API}/grandprixdashboard/${year}`)
            .then((res) => (res.ok ? res.json() : []))
            .then((data) => {
                setGrandprix(Array.isArray(data) ? data : []);
                setLoadedYear(year);
            })
            .catch(() => {
                setGrandprix([]);
                setLoadedYear(year);
            });
    }, [year]);

    /* session states flip to LIVE / FINISHED without a reload */
    useEffect(() => {
        const id = setInterval(() => setMinuteTick((t) => t + 1), 60000);
        return () => clearInterval(id);
    }, []);

    /* minuteTick re-derives the now-dependent journey states once a minute */
    const { focusRound, liveLabel, doneCount } = useMemo(() => {
        const now = new Date();
        let focus = null;
        let live = null;
        let done = 0;
        for (const race of grandprix) {
            const start = raceStart(race);
            if (start && start < now) done += 1;
        }
        for (const race of grandprix) {
            const sessions = getWeekendSessions(race);
            const upcoming = sessions.find((s) => s.start > now);
            const running = sessions.find((s) => {
                const end = new Date(s.start.getTime() + s.minutes * 60 * 1000);
                return now >= s.start && now <= end;
            });
            if (running) {
                focus = race.round;
                live = running.label;
                break;
            }
            if (upcoming) {
                focus = race.round;
                break;
            }
        }
        return { focusRound: focus, liveLabel: live, doneCount: done };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grandprix, minuteTick]);

    const loaded = loadedYear === year;
    const focusRace = grandprix.find((r) => r.round === focusRound) || null;

    const filtered = grandprix.filter((ele) =>
        `${ele.raceName} ${ele.Circuit.Location.country}`
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    const stateFor = (race) => {
        if (race.round === focusRound) return "focus";
        const start = raceStart(race);
        return start && start < new Date() ? "done" : "future";
    };

    /* podium data is fetched lazily, the first time a finished checkpoint
       is hovered/focused, and cached per year+round */
    const peekResults = (round) => {
        const key = `${year}-${round}`;
        if (resultsCache[key] !== undefined) return;
        setResultsCache((c) => ({ ...c, [key]: null }));
        fetch(`${API}/grandprixdashboard/results/${year}/${round}`)
            .then((res) => (res.ok ? res.json() : []))
            .then((data) =>
                setResultsCache((c) => ({ ...c, [key]: Array.isArray(data) ? data : [] }))
            )
            .catch(() => setResultsCache((c) => ({ ...c, [key]: [] })));
    };

    const winnerFor = (round) => {
        const cached = resultsCache[`${year}-${round}`];
        if (!cached || cached.length === 0) return null;
        return `${cached[0].Driver.givenName} ${cached[0].Driver.familyName}`;
    };

    return (
        <div className="rw">
            <header className="rw-hero">
                <span className="rw-hero-eyebrow rw-mono">FORMULA 1 · {year} SEASON</span>
                <h1 className="rw-hero-title">RACE WEEKEND</h1>
                <p className="rw-hero-sub rw-mono">
                    {loaded && grandprix.length > 0 ? grandprix.length : 24} GRAND PRIX. ONE
                    CHAMPIONSHIP JOURNEY.
                </p>
                <div className="rw-hero-rule" aria-hidden="true" />

                <div className="rw-controls">
                    <label className="rw-field">
                        <span className="rw-field-label rw-mono">SEASON</span>
                        <select value={year} onChange={(e) => setYear(e.target.value)}>
                            {YEARS.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </label>
                    <label className="rw-field">
                        <span className="rw-field-label rw-mono">LOCATE</span>
                        <input
                            type="text"
                            placeholder="Race or country…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </label>
                    <span className="rw-count rw-mono">
                        {filtered.length} RACE{filtered.length !== 1 ? "S" : ""}
                    </span>
                </div>
            </header>

            {!loaded ? (
                <div className="rw-loading"><LoadingSpinner /></div>
            ) : (
                <main className="rw-main">
                    {focusRace && !search && (
                        <FocusModule
                            race={focusRace}
                            year={year}
                            isLive={Boolean(liveLabel)}
                            liveLabel={liveLabel}
                            doneCount={doneCount}
                            totalCount={grandprix.length}
                        />
                    )}

                    {filtered.length === 0 ? (
                        <div className="rw-empty">
                            <span className="rw-empty-title">NO DESTINATION FOUND</span>
                            <span className="rw-empty-sub rw-mono">
                                ADJUST THE SEASON OR SEARCH
                            </span>
                        </div>
                    ) : (
                        <section className="rw-journey" aria-label="Season calendar">
                            <span className="rw-journey-start rw-mono" aria-hidden="true">
                                SEASON START
                            </span>
                            <ol className="rw-route">
                                {filtered.map((race, i) => (
                                    <Checkpoint
                                        key={race.round}
                                        race={race}
                                        state={stateFor(race)}
                                        year={year}
                                        index={i}
                                        results={resultsCache[`${year}-${race.round}`]}
                                        winner={winnerFor(race.round)}
                                        onPeek={() => peekResults(race.round)}
                                    />
                                ))}
                            </ol>
                            <span className="rw-journey-finish rw-mono" aria-hidden="true">
                                <span className="rw-chequer" /> CHAMPIONSHIP DECIDED
                            </span>
                        </section>
                    )}
                </main>
            )}
        </div>
    );
}

export default GrandPrix;
