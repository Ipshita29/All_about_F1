/*
 * RACE WEEKEND — the championship season as a chronological journey.
 *
 * A slim upcoming-race strip (round, name/circuit/dates, countdown +
 * Explore) sits directly above a light Cararra season timeline: every
 * round, its winner (once run), and — on hover — a concise podium +
 * fastest-lap preview. The strip replaces what used to be a large dark
 * featured-race card; the circuit map and detailed session schedule it
 * used to show live only after following "Explore" into Race HQ
 * (RaceWeekendDetails.jsx), which already carries that detail. Same
 * backend endpoints as before; year select and search are preserved.
 * Winners are now fetched eagerly for every completed round (not just
 * on hover) so the timeline reads chronologically without an
 * interaction first — same existing results endpoint, just called
 * proactively instead of lazily.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingSpinner } from "../components/UI";
import useCountdown from "../hooks/useCountdown";
import useInViewOnce from "../hooks/useInViewOnce";
import { formatSessionTime } from "../utils/timeUtils";
import { getWeekendSessions, formatWeekendRange } from "../utils/landingHelpers";
import "../styles/pages/RaceWeekend.css";
import { API_BASE_URL as API } from "../config/api";

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

/* ── Minimal upcoming-race strip: round, name/circuit/dates, countdown +
   Explore — the full circuit map and session-by-session schedule only
   show up after following this into Race HQ (RaceWeekendDetails.jsx),
   which already carries that detail; see the file header above. ───── */

function UpcomingStrip({ race, year, isLive, liveLabel }) {
    const sessions = getWeekendSessions(race);
    const raceSession = sessions.find((s) => s.key === "Race");
    const countdown = useCountdown(raceSession?.start || null);

    return (
        <Link
            to={`/grandprixdashboard/${year}/${race.round}`}
            viewTransition
            className={`rw-strip${isLive ? " rw-strip--live" : ""}`}
            aria-label={`Explore ${race.raceName}`}
        >
            <div className="rw-strip-left">
                <span className="rw-strip-dot" aria-hidden="true" />
                <span className="rw-strip-label rw-mono">
                    {isLive ? `LIVE · ${liveLabel}` : "NEXT RACE"} · ROUND {race.round}
                </span>
            </div>

            <div className="rw-strip-center">
                <h2
                    className="rw-strip-title"
                    style={{ viewTransitionName: `gp-title-${year}-${race.round}` }}
                >
                    {race.raceName}
                </h2>
                <p className="rw-strip-meta rw-mono">
                    {race.Circuit?.circuitName?.toUpperCase()} ·{" "}
                    {race.Circuit?.Location?.locality?.toUpperCase()},{" "}
                    {race.Circuit?.Location?.country?.toUpperCase()} · {formatWeekendRange(race)}
                </p>
            </div>

            <div className="rw-strip-right">
                {raceSession && countdown.total > 0 && (
                    <span
                        className="rw-strip-countdown rw-mono"
                        role="timer"
                        aria-label={`Race starts in ${countdown.days} days ${countdown.hours} hours ${countdown.minutes} minutes`}
                    >
                        {pad(countdown.days)}D {pad(countdown.hours)}H {pad(countdown.minutes)}M
                    </span>
                )}
                <span className="rw-strip-explore rw-mono">
                    Explore <span aria-hidden="true">→</span>
                </span>
            </div>
        </Link>
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
    const { focusRound, liveLabel } = useMemo(() => {
        const now = new Date();
        let focus = null;
        let live = null;
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
        return { focusRound: focus, liveLabel: live };
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
                            <UpcomingStrip
                                race={focusRace}
                                year={year}
                                isLive={Boolean(liveLabel)}
                                liveLabel={liveLabel}
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
