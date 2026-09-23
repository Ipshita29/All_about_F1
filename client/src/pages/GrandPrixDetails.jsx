/*
 * GRAND PRIX DETAILS — the race weekend as an operational headquarters.
 *
 * DARK hero (identity, countdown, next session, weekend timeline) →
 * LIGHT circuit intelligence (blueprint, stats, conditions brief, track
 * guide) → DARK championship progress → DARK results. All data comes
 * from the same endpoints as before and every KnowMore term / modal is
 * preserved; only the presentation changed. Shares RaceWeekend.css
 * (.rw namespace) with the Race Weekend journey.
 */
import { Link, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { circuitInfo } from "../data/circuitInfo";
import LoadingSpinner from "../components/LoadingSpinner";
import KnowMoreModal from "../components/KnowMoreModal";
import { knowMoreInfo } from "../data/knowMoreInfo";
import KnowMoreTerm from "../components/KnowMoreTerm";
import CircuitVisualization from "../components/CircuitVisualization";
import { formatSessionTime } from "../utils/timeUtils";
import useCountdown from "../hooks/useCountdown";
import useInViewOnce from "../hooks/useInViewOnce";
import { getWeekendSessions } from "../utils/landingHelpers";
import "./RaceWeekend.css";

const API = "http://localhost:3000";

function pad(n) {
    return String(n).padStart(2, "0");
}

/* Section wrapper: eyebrow heading + one-time reveal on scroll */
function HqSection({ eyebrow, title, children, wide = false, onLight = false }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.12 });
    return (
        <section
            ref={ref}
            className={`rw-hq-section${inView ? " rw-hq-section--in" : ""}${wide ? " rw-hq-section--wide" : ""}${onLight ? " rw-hq-section--on-light" : ""}`}
        >
            <header className="rw-hq-section-head">
                {eyebrow && <span className="rw-hq-eyebrow rw-mono">{eyebrow}</span>}
                <h2 className="rw-hq-section-title">{title}</h2>
            </header>
            {children}
        </section>
    );
}

/* Count-up used by the circuit stat tiles — animates once when visible */
function CountUp({ value }) {
    const numeric = Number(value);
    const [ref, inView] = useInViewOnce({ threshold: 0.4 });
    const [shown, setShown] = useState(0);
    const started = useRef(false);

    useEffect(() => {
        if (!inView || started.current || Number.isNaN(numeric)) return;
        started.current = true;
        const t0 = performance.now();
        const dur = 900;
        let raf;
        const step = (t) => {
            const p = Math.min(1, (t - t0) / dur);
            setShown(Math.round(numeric * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [inView, numeric]);

    if (Number.isNaN(numeric)) return <span ref={ref}>{value}</span>;
    return <span ref={ref}>{shown}</span>;
}

function GrandPrixDetails() {
    const { year, id } = useParams();
    const [season, setSeason] = useState([]);
    const [race, setRace] = useState(null);
    const [results, setResults] = useState([]);
    const [qualifying, setQualifying] = useState([]);
    const [selectedTerm, setSelectedTerm] = useState(null);

    useEffect(() => {
        fetch(`${API}/grandprixdashboard/${year}`)
            .then((res) => { if (!res.ok) return []; return res.json(); })
            .then((data) => {
                const list = Array.isArray(data) ? data : [];
                setSeason(list);
                setRace(list.find((ele) => ele.round === id));
            });
    }, [year, id]);

    useEffect(() => {
        fetch(`${API}/grandprixdashboard/results/${year}/${id}`)
            .then((res) => { if (!res.ok) return []; return res.json(); })
            .then((data) => setResults(Array.isArray(data) ? data : []));
    }, [year, id]);

    useEffect(() => {
        fetch(`${API}/grandprixdashboard/qualifying/${year}/${id}`)
            .then((res) => { if (!res.ok) return []; return res.json(); })
            .then((data) => setQualifying(Array.isArray(data) ? data : []))
            .catch(() => setQualifying([]));
    }, [year, id]);

    const sessions = race ? getWeekendSessions(race) : [];
    const raceSession = sessions.find((s) => s.key === "Race");
    const countdown = useCountdown(raceSession?.start || null);

    if (!race) return <div className="rw rw-loading"><LoadingSpinner /></div>;

    const now = new Date();
    const raceDate = new Date(race.date + "T00:00:00");
    const raceNotStarted = raceDate > now;

    const formattedDate = raceDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    /* the first session still ahead of us, highlighted on the session rail */
    const nextSession = sessions.find((s) => s.start > now) || null;

    /* KnowMore slugs for the session rail rows */
    const sessionTermFor = (key) =>
        ({ FirstPractice: "fp1", SecondPractice: "fp2", ThirdPractice: "fp3", Sprint: "sprint", Qualifying: "qualifying" }[key] || null);

    const fastestLap = results.find((r) => r.FastestLap?.rank === "1") || null;

    const biggestGainer =
        results.length > 0
            ? results.reduce((best, current) => {
                const currentGain = Number(current.grid) - Number(current.position);
                const bestGain = Number(best.grid) - Number(best.position);
                return currentGain > bestGain ? current : best;
            }, results[0])
            : null;
    const positionsGained = biggestGainer
        ? Number(biggestGainer.grid) - Number(biggestGainer.position)
        : 0;

    const teamPerformance = {};
    results.forEach((result) => {
        const teamName = result.Constructor.name;
        if (!teamPerformance[teamName]) {
            teamPerformance[teamName] = { points: 0, drivers: [] };
        }
        teamPerformance[teamName].points += Number(result.points);
        teamPerformance[teamName].drivers.push({
            position: result.position,
            name: `${result.Driver.givenName} ${result.Driver.familyName}`,
        });
    });
    const sortedTeams = Object.entries(teamPerformance)
        .map(([name, data]) => ({ name, points: data.points, drivers: data.drivers }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 3);

    const circuitData = circuitInfo[race?.Circuit?.circuitId];

    const podiumOrder = [1, 0, 2]; // P2 · P1 · P3 plinth arrangement

    /* Championship progress — same "rounds already underway" logic as the
       Race Weekend journey page, derived from the same season list. */
    const totalRounds = season.length;
    const completedRounds = season.filter((r) => {
        const start = r.time ? new Date(`${r.date}T${r.time}`) : new Date(`${r.date}T00:00:00`);
        return start < now;
    }).length;
    const progressPct = totalRounds > 0 ? Math.round((completedRounds / totalRounds) * 100) : 0;

    return (
        <div className="rw rw-hq">
            {/* ── Hero: identity, countdown, next session, weekend plan ── */}
            <header className={`rw-hq-hero${raceNotStarted ? "" : " rw-hq-hero--complete"}`}>
                <div className="rw-hq-hero-inner">
                    <Link to="/grandprixdashboard" className="rw-back rw-mono" viewTransition>
                        ← CHAMPIONSHIP JOURNEY
                    </Link>

                    <span className="rw-hq-status rw-mono">
                        <span className={`rw-focus-dot${raceNotStarted ? "" : " rw-focus-dot--done"}`} aria-hidden="true" />
                        {raceNotStarted ? "WEEKEND STATUS — UPCOMING" : "WEEKEND STATUS — COMPLETE"}
                        {" · "}FORMULA 1 · {year} SEASON · ROUND {race.round}
                    </span>

                    <h1
                        className="rw-hq-title"
                        style={{ viewTransitionName: `gp-title-${year}-${race.round}` }}
                    >
                        {race.raceName}
                    </h1>

                    <p className="rw-hq-meta rw-mono">
                        {race.Circuit.circuitName?.toUpperCase()} ·{" "}
                        {race.Circuit.Location.locality?.toUpperCase()},{" "}
                        {race.Circuit.Location.country?.toUpperCase()} · {formattedDate.toUpperCase()}
                    </p>

                    <div className="rw-hq-hero-cols">
                        <div className="rw-hq-hero-main">
                            {raceNotStarted && countdown.total > 0 && (
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

                            {nextSession && (
                                <p className="rw-focus-session rw-hq-next-session">
                                    <span className="rw-mono rw-focus-session-label">
                                        {raceNotStarted ? "NEXT SESSION" : "FINAL SESSION"}
                                    </span>
                                    <span className="rw-focus-session-value">
                                        {nextSession.label}{" "}
                                        <span className="rw-mono">— {formatSessionTime(nextSession.date, nextSession.time)}</span>
                                    </span>
                                </p>
                            )}

                            <p className="rw-hq-wiki">
                                <a href={race.url} target="_blank" rel="noreferrer">
                                    {race.raceName} — Wikipedia dossier ↗
                                </a>
                            </p>
                        </div>

                        <ol className="rw-rail">
                            {sessions.map((s) => {
                                const isNext = nextSession?.key === s.key;
                                const isPast = s.start <= now && !isNext;
                                const term = sessionTermFor(s.key);
                                return (
                                    <li
                                        key={s.key}
                                        className={`rw-rail-stop${isNext ? " rw-rail-stop--next" : ""}${isPast ? " rw-rail-stop--past" : ""}${s.key === "Race" ? " rw-rail-stop--race" : ""}`}
                                    >
                                        <span className="rw-rail-dot" aria-hidden="true" />
                                        <span className="rw-rail-name">
                                            {term ? (
                                                <KnowMoreTerm
                                                    term={term}
                                                    setSelectedTerm={setSelectedTerm}
                                                    knowMoreInfo={knowMoreInfo}
                                                >
                                                    {s.label}
                                                </KnowMoreTerm>
                                            ) : (
                                                s.label
                                            )}
                                            {isNext && <span className="rw-rail-next rw-mono">NEXT</span>}
                                        </span>
                                        <span className="rw-rail-time rw-mono">
                                            {formatSessionTime(s.date, s.time)}
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                </div>
            </header>

            <main className="rw-hq-main">
                {/* ── Circuit intelligence (light) ───────────────────── */}
                {circuitData && (
                    <section className="rw-hq-circuit">
                        <div className="rw-hq-circuit-inner">
                            <div className="rw-hq-circuit-visual">
                                <CircuitVisualization
                                    circuitId={race.Circuit?.circuitId}
                                    circuitName={race.Circuit?.circuitName}
                                    info={circuitData}
                                />
                            </div>

                            <div className="rw-hq-circuit-body">
                                <span className="rw-hq-eyebrow rw-hq-eyebrow--on-light rw-mono">ENGINEERING</span>
                                <h2 className="rw-hq-section-title rw-hq-section-title--on-light">Circuit Intelligence</h2>

                                {circuitData.summary && <p className="rw-hq-prose rw-hq-prose--on-light">{circuitData.summary}</p>}

                                <div className="rw-circuit-stats">
                                    <div className="rw-cstat">
                                        <span className="rw-cstat-value rw-mono"><CountUp value={circuitData.laps} /></span>
                                        <span className="rw-cstat-label rw-mono">LAPS</span>
                                    </div>
                                    <div className="rw-cstat">
                                        <span className="rw-cstat-value rw-mono"><CountUp value={circuitData.turns} /></span>
                                        <span className="rw-cstat-label rw-mono">TURNS</span>
                                    </div>
                                    {circuitData.drsZones != null && (
                                        <div className="rw-cstat">
                                            <span className="rw-cstat-value rw-mono"><CountUp value={circuitData.drsZones} /></span>
                                            <span className="rw-cstat-label rw-mono">
                                                <KnowMoreTerm term="drs" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>DRS</KnowMoreTerm> ZONES
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <dl className="rw-records rw-records--on-light">
                                    {circuitData.length && (
                                        <div className="rw-record-row">
                                            <dt className="rw-mono">TRACK LENGTH</dt>
                                            <dd>{circuitData.length}</dd>
                                        </div>
                                    )}
                                    {circuitData.raceDistance && (
                                        <div className="rw-record-row">
                                            <dt className="rw-mono">RACE DISTANCE</dt>
                                            <dd>{circuitData.raceDistance}</dd>
                                        </div>
                                    )}
                                    {circuitData.lapRecord && (
                                        <div className="rw-record-row">
                                            <dt className="rw-mono">
                                                <KnowMoreTerm term="fastest_lap" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>LAP RECORD</KnowMoreTerm>
                                            </dt>
                                            <dd>{circuitData.lapRecord} — {circuitData.lapRecordHolder} ({circuitData.lapRecordYear})</dd>
                                        </div>
                                    )}
                                    {circuitData.firstGrandPrix && (
                                        <div className="rw-record-row">
                                            <dt className="rw-mono">FIRST GRAND PRIX</dt>
                                            <dd>{circuitData.firstGrandPrix}</dd>
                                        </div>
                                    )}
                                    {circuitData.trackType && (
                                        <div className="rw-record-row">
                                            <dt className="rw-mono">TRACK TYPE</dt>
                                            <dd>{circuitData.trackType}</dd>
                                        </div>
                                    )}
                                </dl>

                                {circuitData.weatherImpact && (
                                    <p className="rw-focus-weather rw-focus-weather--on-light">
                                        <span className="rw-mono rw-focus-session-label">CONDITIONS BRIEF</span>
                                        {circuitData.weatherImpact}
                                    </p>
                                )}
                            </div>
                        </div>

                        {(circuitData.famousFor || circuitData.keyCorners?.length > 0 || circuitData.funFacts?.length > 0) && (
                            <div className="rw-hq-circuit-extra">
                                {circuitData.famousFor && (
                                    <div className="rw-hq-circuit-extra-block">
                                        <span className="rw-hq-eyebrow rw-hq-eyebrow--on-light rw-mono">REPUTATION</span>
                                        <p className="rw-hq-prose rw-hq-prose--on-light">{circuitData.famousFor}</p>
                                    </div>
                                )}
                                {circuitData.keyCorners?.length > 0 && (
                                    <div className="rw-hq-circuit-extra-block">
                                        <span className="rw-hq-eyebrow rw-hq-eyebrow--on-light rw-mono">TRACK GUIDE</span>
                                        <ul className="rw-corners rw-corners--on-light">
                                            {circuitData.keyCorners.map((corner, i) => (
                                                <li key={i} className="rw-corner">
                                                    <span className="rw-corner-apex rw-mono">{pad(i + 1)}</span>
                                                    <p>{corner}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {circuitData.funFacts?.length > 0 && (
                                    <div className="rw-hq-circuit-extra-block">
                                        <span className="rw-hq-eyebrow rw-hq-eyebrow--on-light rw-mono">PADDOCK NOTES</span>
                                        <ul className="rw-facts rw-facts--on-light">
                                            {circuitData.funFacts.map((fact, i) => (
                                                <li key={i} className="rw-fact rw-fact--on-light">{fact}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                )}

                {/* ── Championship progress ──────────────────────────── */}
                {totalRounds > 0 && (
                    <HqSection eyebrow="THE SEASON" title="Championship Progress">
                        <span className="rw-mono rw-focus-progress-label">
                            {completedRounds} OF {totalRounds} ROUNDS COMPLETE
                        </span>
                        <div className="rw-progress-track rw-progress-track--wide">
                            <div className="rw-progress-fill" style={{ width: `${progressPct}%` }} />
                            <div className="rw-progress-marker" style={{ left: `${progressPct}%` }} />
                        </div>
                        <div className="rw-progress-stats">
                            <div>
                                <span className="rw-cstat-value rw-mono">{race.round}</span>
                                <span className="rw-cstat-label rw-mono">THIS ROUND</span>
                            </div>
                            <div>
                                <span className="rw-cstat-value rw-mono">{completedRounds}</span>
                                <span className="rw-cstat-label rw-mono">COMPLETED</span>
                            </div>
                            <div>
                                <span className="rw-cstat-value rw-mono">{Math.max(0, totalRounds - completedRounds)}</span>
                                <span className="rw-cstat-label rw-mono">REMAINING</span>
                            </div>
                        </div>
                    </HqSection>
                )}

                {raceNotStarted && (
                    <HqSection eyebrow="STANDBY" title="Awaiting Green Light">
                        <div className="rw-hq-standby">
                            <p>This race has not taken place yet.</p>
                            <p>
                                Race results, qualifying classification, fastest lap, podium
                                finishers and race statistics will populate this command room
                                after the race weekend.
                            </p>
                        </div>
                    </HqSection>
                )}

                {!raceNotStarted && results.length > 0 && (
                    <>
                        {/* ── Podium ────────────────────────────────── */}
                        <HqSection
                            eyebrow="CLASSIFICATION"
                            title={
                                <KnowMoreTerm term="podium" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>
                                    Podium
                                </KnowMoreTerm>
                            }
                        >
                            <div className="rw-podium">
                                {podiumOrder.map((idx) => {
                                    const r = results[idx];
                                    if (!r) return null;
                                    return (
                                        <div className={`rw-plinth rw-plinth--p${idx + 1}`} key={r.position}>
                                            <span className="rw-plinth-pos rw-mono">P{r.position}</span>
                                            <span className="rw-plinth-name">
                                                {r.Driver.givenName} <b>{r.Driver.familyName}</b>
                                            </span>
                                            <span className="rw-plinth-team">{r.Constructor.name}</span>
                                            <span className="rw-plinth-pts rw-mono">{r.points} PTS</span>
                                            <span className="rw-plinth-base" aria-hidden="true" />
                                        </div>
                                    );
                                })}
                            </div>
                        </HqSection>

                        {/* ── Highlights ────────────────────────────── */}
                        <HqSection eyebrow="TELEMETRY" title="Race Highlights">
                            <div className="rw-highlights">
                                {qualifying.length > 0 && (
                                    <div className="rw-highlight">
                                        <span className="rw-highlight-label rw-mono">
                                            <KnowMoreTerm term="pole_position" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>
                                                POLE POSITION
                                            </KnowMoreTerm>
                                        </span>
                                        <span className="rw-highlight-value">
                                            {qualifying[0].Driver.givenName} {qualifying[0].Driver.familyName}
                                        </span>
                                        <span className="rw-highlight-sub rw-mono">
                                            {qualifying[0].Q3 || qualifying[0].Q2 || qualifying[0].Q1}
                                        </span>
                                    </div>
                                )}
                                {fastestLap && (
                                    <div className="rw-highlight">
                                        <span className="rw-highlight-label rw-mono">
                                            <KnowMoreTerm term="fastest_lap" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>
                                                FASTEST LAP
                                            </KnowMoreTerm>
                                        </span>
                                        <span className="rw-highlight-value">
                                            {fastestLap.Driver.givenName} {fastestLap.Driver.familyName}
                                        </span>
                                        <span className="rw-highlight-sub rw-mono">
                                            {fastestLap.FastestLap.Time.time} · LAP {fastestLap.FastestLap.lap}
                                        </span>
                                    </div>
                                )}
                                {biggestGainer && positionsGained > 0 && (
                                    <div className="rw-highlight">
                                        <span className="rw-highlight-label rw-mono">BIGGEST GAINER</span>
                                        <span className="rw-highlight-value">
                                            {biggestGainer.Driver.givenName} {biggestGainer.Driver.familyName}
                                        </span>
                                        <span className="rw-highlight-sub rw-mono">
                                            P{biggestGainer.grid} → P{biggestGainer.position} (+{positionsGained})
                                        </span>
                                    </div>
                                )}
                            </div>
                        </HqSection>

                        {/* ── Qualifying ────────────────────────────── */}
                        <HqSection
                            eyebrow="SATURDAY"
                            title={
                                <KnowMoreTerm term="qualifying" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>
                                    Qualifying
                                </KnowMoreTerm>
                            }
                        >
                            <ol className="rw-timing">
                                {qualifying.slice(0, 10).map((driver) => (
                                    <li key={driver.position} className="rw-timing-row">
                                        <span className="rw-timing-pos rw-mono">P{driver.position}</span>
                                        <span className="rw-timing-name">
                                            {driver.Driver.givenName} <b>{driver.Driver.familyName}</b>
                                        </span>
                                        <span className="rw-timing-team">{driver.Constructor.name}</span>
                                        <span className="rw-timing-time rw-mono">
                                            {driver.Q3
                                                ? `Q3 ${driver.Q3}`
                                                : driver.Q2
                                                    ? `Q2 ${driver.Q2}`
                                                    : `Q1 ${driver.Q1 || "—"}`}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </HqSection>

                        {/* ── Race classification ───────────────────── */}
                        <HqSection eyebrow="SUNDAY" title="Race Classification" wide>
                            <ol className="rw-timing">
                                {results.map((result) => (
                                    <li key={result.position} className="rw-timing-row">
                                        <span className="rw-timing-pos rw-mono">P{result.position}</span>
                                        <span className="rw-timing-name">
                                            {result.Driver.givenName} <b>{result.Driver.familyName}</b>
                                        </span>
                                        <span className="rw-timing-team">{result.Constructor.name}</span>
                                        <span className="rw-timing-grid rw-mono">GRID P{result.grid}</span>
                                        <span className="rw-timing-time rw-mono">
                                            {result.status !== "Finished" && !result.status.startsWith("+") ? (
                                                <KnowMoreTerm term="retirement" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>
                                                    {`DNF — ${result.status}`}
                                                </KnowMoreTerm>
                                            ) : (
                                                `${result.points} PTS`
                                            )}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </HqSection>

                        {/* ── Team performance ──────────────────────── */}
                        <HqSection eyebrow="PIT WALL" title="Top Teams Of The Weekend">
                            <div className="rw-teams">
                                {sortedTeams.map((team, i) => (
                                    <div className="rw-team-card" key={team.name}>
                                        <span className="rw-team-rank rw-mono">{i + 1}</span>
                                        <h3 className="rw-team-name">{team.name}</h3>
                                        {team.drivers.map((driver) => (
                                            <p className="rw-team-driver" key={driver.name}>
                                                <span className="rw-mono">P{driver.position}</span> {driver.name}
                                            </p>
                                        ))}
                                        <span className="rw-team-pts rw-mono">{team.points} PTS</span>
                                    </div>
                                ))}
                            </div>
                        </HqSection>
                    </>
                )}
            </main>

            <KnowMoreModal info={selectedTerm} onClose={() => setSelectedTerm(null)} />
        </div>
    );
}

export default GrandPrixDetails;
