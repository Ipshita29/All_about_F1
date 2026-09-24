/*
 * RACE WEEKEND — the championship season as a chronological journey.
 *
 * A dark hero + focus module (the current/next race weekend, with a real
 * countdown and championship-progress readout) leads into a light Cararra
 * season timeline: every round, its winner (once run), and — on hover —a
 * concise podium + fastest-lap preview. Same backend endpoints as before;
 * year select and search are preserved. Winners are now fetched eagerly
 * for every completed round (not just on hover) so the timeline reads
 * chronologically without an interaction first — same existing results
 * endpoint, just called proactively instead of lazily.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CircuitVisualization from "../components/CircuitVisualization";
import Button from "../components/Button";
import LoadingSpinner from "../components/LoadingSpinner";
import useCountdown from "../hooks/useCountdown";
import useInViewOnce from "../hooks/useInViewOnce";
import { circuitInfo } from "../data/circuitInfo";
import { formatSessionTime } from "../utils/timeUtils";
import { getWeekendSessions, formatWeekendRange } from "../utils/landingHelpers";
import "../styles/pages/RaceWeekend.css";

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
                            className="rw-countdown"
                            role="timer"
                            aria-label={`Race starts in ${countdown.days} days ${countdown.hours} hours ${countdown.minutes} minutes ${countdown.seconds} seconds`}
                        >
                            {[
                                [countdown.days, "DAYS"],
                                [countdown.hours, "HRS"],
                                [countdown.minutes, "MIN"],
                                [countdown.seconds, "SEC"],
                            ].map(([val, lbl]) => (
                                <span className="rw-countdown-unit" key={lbl}>
                                    <b className="rw-mono">{pad(val)}</b>
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
                            <span className="rw-focus-session-value">
                                {nextUp.label} <span className="rw-mono">— {formatSessionTime(nextUp.date, nextUp.time)}</span>
                            </span>
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

                    <Button
                        variant="primary"
                        to={`/grandprixdashboard/${year}/${race.round}`}
                        viewTransition
                        arrow
                        className="rw-focus-cta"
                    >
                        Enter Race HQ
                    </Button>
                </div>

                <div className="rw-focus-map">
                    <CircuitVisualization
                        circuitId={race.Circuit?.circuitId}
                        circuitName={race.Circuit?.circuitName}
                        info={circuit}
                    />
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

/* ── One round on the season timeline ─────────────────────────────── */

function Checkpoint({ race, state, year, results, winner, onPeek }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.18 });
    const hasSprint = Boolean(race.Sprint);

    const stateLabel =
        state === "done" ? "FINISHED" : state === "focus" ? "YOU ARE HERE" : "UPCOMING";

    return (
        <li
            ref={ref}
            className={`rw-stop rw-stop--${state}${inView ? " rw-stop--in" : ""}`}
        >
            <Link
                to={`/grandprixdashboard/${year}/${race.round}`}
                viewTransition
                className="rw-stop-card"
                onMouseEnter={state === "done" ? onPeek : undefined}
                onFocus={state === "done" ? onPeek : undefined}
            >
                <div className="rw-stop-top rw-mono">
                    <span className="rw-stop-round">ROUND {pad(Number(race.round))}</span>
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

    /* podium data is fetched per round (year+round), cached so a round is
       only ever requested once */
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

    /* Winners are fetched eagerly for every completed round once the season
       loads, so the timeline shows "WINNER" without requiring a hover
       first — same results endpoint as the hover peek, just called
       proactively. */
    useEffect(() => {
        if (!loaded) return;
        const now = new Date();
        grandprix.forEach((race) => {
            const start = raceStart(race);
            if (start && start < now) peekResults(race.round);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded, grandprix]);

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
                <>
                    {focusRace && !search && (
                        <div className="rw-main">
                            <FocusModule
                                race={focusRace}
                                year={year}
                                isLive={Boolean(liveLabel)}
                                liveLabel={liveLabel}
                                doneCount={doneCount}
                                totalCount={grandprix.length}
                            />
                        </div>
                    )}

                    <section className="rw-journey" aria-label="Season calendar">
                        <div className="rw-journey-inner">
                            <span className="rw-journey-start rw-mono" aria-hidden="true">
                                SEASON START
                            </span>

                            {filtered.length === 0 ? (
                                <div className="rw-empty">
                                    <span className="rw-empty-title">NO DESTINATION FOUND</span>
                                    <span className="rw-empty-sub rw-mono">
                                        ADJUST THE SEASON OR SEARCH
                                    </span>
                                </div>
                            ) : (
                                <ol className="rw-route">
                                    {filtered.map((race) => (
                                        <Checkpoint
                                            key={race.round}
                                            race={race}
                                            state={stateFor(race)}
                                            year={year}
                                            results={resultsCache[`${year}-${race.round}`]}
                                            winner={winnerFor(race.round)}
                                            onPeek={() => peekResults(race.round)}
                                        />
                                    ))}
                                </ol>
                            )}

                            {filtered.length > 0 && (
                                <span className="rw-journey-finish rw-mono" aria-hidden="true">
                                    CHAMPIONSHIP DECIDED
                                </span>
                            )}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}

export default GrandPrix;
