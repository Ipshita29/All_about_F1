/*
 * GRAND PRIX DETAILS — the race weekend as an operational headquarters.
 *
 * The hero is a command-room wall: circuit blueprint, race branding, weekend
 * status and countdown. Below it the user is guided through the session
 * plan, qualifying, race classification, team performance and the circuit
 * dossier. All data comes from the same endpoints as before and every
 * KnowMore term / modal is preserved; only the presentation changed.
 * Shares RaceWeekend.css (.rw namespace) with the Race Weekend journey.
 */
import { Link, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { circuitInfo } from "../data/circuitInfo";
import LoadingSpinner from "../components/LoadingSpinner";
import KnowMoreModal from "../components/KnowMoreModal";
import { knowMoreInfo } from "../data/knowMoreInfo";
import KnowMoreTerm from "../components/KnowMoreTerm";
import { formatSessionTime } from "../utils/timeUtils";
import useCountdown from "../hooks/useCountdown";
import useInViewOnce from "../hooks/useInViewOnce";
import { getWeekendSessions, circuitMapSrc } from "../utils/landingHelpers";
import "./RaceWeekend.css";

const API = "http://localhost:3000";

function pad(n) {
    return String(n).padStart(2, "0");
}

/* Section wrapper: eyebrow heading + one-time reveal on scroll */
function HqSection({ eyebrow, title, children, wide = false }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.12 });
    return (
        <section
            ref={ref}
            className={`rw-hq-section${inView ? " rw-hq-section--in" : ""}${wide ? " rw-hq-section--wide" : ""}`}
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

function GrandPrixDetails() {
    const { year, id } = useParams();
    const [race, setRace] = useState(null);
    const [results, setResults] = useState([]);
    const [qualifying, setQualifying] = useState([]);
    const [selectedTerm, setSelectedTerm] = useState(null);
    const [mapFailed, setMapFailed] = useState(false);

    useEffect(() => {
        fetch(`${API}/grandprixdashboard/${year}`)
            .then((res) => { if (!res.ok) return []; return res.json(); })
            .then((data) => {
                const selected = data.find((ele) => ele.round === id);
                setRace(selected);
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
    const mapSrc = circuitMapSrc(race.Circuit?.circuitId);

    const podiumOrder = [1, 0, 2]; // P2 · P1 · P3 plinth arrangement

    return (
        <div className="rw rw-hq">
            {/* ── Command-room hero ─────────────────────────────────── */}
            <header className={`rw-hq-hero${raceNotStarted ? "" : " rw-hq-hero--complete"}`}>
                <div className="rw-hq-hero-grid" aria-hidden="true" />

                <div className="rw-hq-hero-inner">
                    <div className="rw-hq-hero-info">
                        <Link to="/grandprixdashboard" className="rw-back rw-mono" viewTransition>
                            ← CHAMPIONSHIP JOURNEY
                        </Link>

                        <span className="rw-hq-status rw-mono">
                            <span className={`rw-focus-dot${raceNotStarted ? "" : " rw-focus-dot--done"}`} aria-hidden="true" />
                            {raceNotStarted ? "WEEKEND STATUS — UPCOMING" : "WEEKEND STATUS — COMPLETE"}
                            {" · "}ROUND {race.round} · {year} SEASON
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

                        {raceNotStarted && countdown.total > 0 && (
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

                        {circuitData?.weatherImpact && (
                            <p className="rw-focus-weather rw-hq-weather">
                                <span className="rw-mono rw-focus-session-label">CONDITIONS BRIEF</span>
                                {circuitData.weatherImpact.split(". ")[0]}.
                            </p>
                        )}

                        <p className="rw-hq-wiki">
                            <a href={race.url} target="_blank" rel="noreferrer">
                                {race.raceName} — Wikipedia dossier ↗
                            </a>
                        </p>
                    </div>

                    <div className="rw-hq-hero-map" aria-hidden="true">
                        {mapSrc && !mapFailed ? (
                            <img
                                src={mapSrc}
                                alt=""
                                className="rw-circuit-img"
                                onError={() => setMapFailed(true)}
                            />
                        ) : (
                            <BlueprintFallback />
                        )}
                        <span className="rw-focus-map-label rw-mono">
                            CIRCUIT BLUEPRINT — {race.Circuit?.circuitId?.toUpperCase()}
                        </span>
                    </div>
                </div>
            </header>

            <main className="rw-hq-main">
                {/* ── Session plan ──────────────────────────────────── */}
                <HqSection eyebrow="OPERATIONS" title="Weekend Session Plan">
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
                </HqSection>

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

                {/* ── Circuit dossier ───────────────────────────────── */}
                {circuitData && (
                    <>
                        <HqSection eyebrow="ENGINEERING" title="Circuit Dossier" wide>
                            <p className="rw-hq-prose">{circuitData.summary}</p>

                            <div className="rw-circuit-stats">
                                <div className="rw-cstat">
                                    <span className="rw-cstat-value rw-mono">
                                        <CountUp value={circuitData.laps} />
                                    </span>
                                    <span className="rw-cstat-label rw-mono">LAPS</span>
                                </div>
                                <div className="rw-cstat">
                                    <span className="rw-cstat-value rw-mono">
                                        <CountUp value={circuitData.turns} />
                                    </span>
                                    <span className="rw-cstat-label rw-mono">TURNS</span>
                                </div>
                                <div className="rw-cstat">
                                    <span className="rw-cstat-value rw-mono">
                                        <CountUp value={circuitData.drsZones} />
                                    </span>
                                    <span className="rw-cstat-label rw-mono">
                                        <KnowMoreTerm term="drs" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>
                                            DRS
                                        </KnowMoreTerm>{" "}
                                        ZONES
                                    </span>
                                </div>
                            </div>

                            <dl className="rw-records">
                                <div className="rw-record-row">
                                    <dt className="rw-mono">TRACK LENGTH</dt>
                                    <dd>{circuitData.length}</dd>
                                </div>
                                <div className="rw-record-row">
                                    <dt className="rw-mono">RACE DISTANCE</dt>
                                    <dd>{circuitData.raceDistance}</dd>
                                </div>
                                {circuitData.lapRecord && (
                                    <div className="rw-record-row">
                                        <dt className="rw-mono">
                                            <KnowMoreTerm term="fastest_lap" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>
                                                LAP RECORD
                                            </KnowMoreTerm>
                                        </dt>
                                        <dd>
                                            {circuitData.lapRecord} — {circuitData.lapRecordHolder} (
                                            {circuitData.lapRecordYear})
                                        </dd>
                                    </div>
                                )}
                                <div className="rw-record-row">
                                    <dt className="rw-mono">FIRST GRAND PRIX</dt>
                                    <dd>{circuitData.firstGrandPrix}</dd>
                                </div>
                                {circuitData.trackType && (
                                    <div className="rw-record-row">
                                        <dt className="rw-mono">TRACK TYPE</dt>
                                        <dd>{circuitData.trackType}</dd>
                                    </div>
                                )}
                            </dl>
                        </HqSection>

                        {circuitData.famousFor && (
                            <HqSection eyebrow="REPUTATION" title="Famous For">
                                <p className="rw-hq-prose">{circuitData.famousFor}</p>
                            </HqSection>
                        )}

                        {circuitData.keyCorners?.length > 0 && (
                            <HqSection eyebrow="TRACK GUIDE" title="Key Corners">
                                <ul className="rw-corners">
                                    {circuitData.keyCorners.map((corner, i) => (
                                        <li key={i} className="rw-corner">
                                            <span className="rw-corner-apex rw-mono">{pad(i + 1)}</span>
                                            <p>{corner}</p>
                                        </li>
                                    ))}
                                </ul>
                            </HqSection>
                        )}

                        {circuitData.funFacts?.length > 0 && (
                            <HqSection eyebrow="PADDOCK NOTES" title="Fun Facts">
                                <ul className="rw-facts">
                                    {circuitData.funFacts.map((fact, i) => (
                                        <li key={i} className="rw-fact">{fact}</li>
                                    ))}
                                </ul>
                            </HqSection>
                        )}
                    </>
                )}
            </main>

            <KnowMoreModal info={selectedTerm} onClose={() => setSelectedTerm(null)} />
        </div>
    );
}

export default GrandPrixDetails;
