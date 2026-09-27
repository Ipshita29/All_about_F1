/*
 * GRAND PRIX DETAILS — the race weekend as an operational headquarters.
 *
 * Weekend Header → Podium + Weekend Schedule (side-by-side) → Complete
 * Driver Results → Race Highlights → Weekend Team Performance → Circuit
 * Essentials. All data comes from the same endpoints as before (plus one
 * new sprint-results endpoint, only ever called on a sprint weekend).
 * Shares RaceWeekend.css (.rw namespace) with the Race Weekend journey.
 */
import { Link, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Flag, Gauge, Map, Repeat, RotateCw, Ruler, Timer, Wrench, Zap } from "lucide-react";
import { circuitInfo } from "../data/circuitInfo";
import { LoadingSpinner } from "../components/UI";
import { formatSessionTime } from "../utils/timeUtils";
import useCountdown from "../hooks/useCountdown";
import useInViewOnce from "../hooks/useInViewOnce";
import { getWeekendSessions } from "../utils/landingHelpers";
import "../styles/pages/RaceWeekend.css";
import { API_BASE_URL as API } from "../config/api";

/* Session-type icon, reused across every weekend regardless of format —
   all three practice sessions share one icon, the rest are distinct. */
const SESSION_ICONS = {
    FirstPractice: Wrench,
    SecondPractice: Wrench,
    ThirdPractice: Wrench,
    SprintQualifying: Gauge,
    Sprint: Zap,
    Qualifying: Timer,
    Race: Flag,
};


function pad(n) {
    return String(n).padStart(2, "0");
}

/* Section wrapper: eyebrow heading + one-time reveal on scroll */
function HqSection({ eyebrow, title, children }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.12 });
    return (
        <section
            ref={ref}
            className={`rw-hq-section${inView ? " rw-hq-section--in" : ""}`}
        >
            <header className="rw-hq-section-head">
                {eyebrow && <span className="rw-hq-eyebrow rw-mono">{eyebrow}</span>}
                <h2 className="rw-hq-section-title">{title}</h2>
            </header>
            {children}
        </section>
    );
}

/* Count-up used by the Circuit Essentials tiles — animates once when
   visible for numeric values, falls back to plain text for strings
   (track type, lap record time, etc). */
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
    const [race, setRace] = useState(null);
    const [results, setResults] = useState([]);
    const [qualifying, setQualifying] = useState([]);
    const [sprintResults, setSprintResults] = useState([]);

    useEffect(() => {
        fetch(`${API}/grandprixdashboard/${year}`)
            .then((res) => { if (!res.ok) return []; return res.json(); })
            .then((data) => {
                const list = Array.isArray(data) ? data : [];
                setRace(list.find((ele) => ele.round === id) || null);
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

    /* Only ever fetched on a genuine sprint weekend — never fabricated
       for a normal one. */
    useEffect(() => {
        const request = race?.Sprint
            ? fetch(`${API}/grandprixdashboard/sprint/${year}/${id}`).then((res) => (res.ok ? res.json() : []))
            : Promise.resolve([]);
        request
            .then((data) => setSprintResults(Array.isArray(data) ? data : []))
            .catch(() => setSprintResults([]));
    }, [year, id, race?.Sprint]);

    const sessions = race ? getWeekendSessions(race) : [];
    const raceSession = sessions.find((s) => s.key === "Race");
    const countdown = useCountdown(raceSession?.start || null);

    if (!race) return <div className="rw rw-loading"><LoadingSpinner /></div>;

    const now = new Date();
    const raceDate = new Date(race.date + "T00:00:00");
    const raceNotStarted = raceDate > now;
    const hasSprint = Boolean(race.Sprint);

    const formattedDate = raceDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    /* the first session still ahead of us, highlighted on the schedule card */
    const nextSession = sessions.find((s) => s.start > now) || null;

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

    /* Compact "Qualifying / Sprint" cell for the Driver Results table —
       normal weekend shows only qualifying position; a sprint weekend
       adds the sprint result alongside it. A driver missing from either
       session (DNS, DSQ) shows — rather than a fabricated position. */
    const qualiFor = (driverId) => qualifying.find((q) => q.Driver.driverId === driverId) || null;
    const sprintFor = (driverId) => sprintResults.find((s) => s.Driver.driverId === driverId) || null;

    const essentials = circuitData
        ? [
            { icon: Ruler, value: circuitData.length, label: "Track Length" },
            { icon: RotateCw, value: circuitData.turns, label: "Turns" },
            { icon: Repeat, value: circuitData.laps, label: "Laps" },
            { icon: Zap, value: circuitData.drsZones, label: "DRS Zones" },
            { icon: Flag, value: circuitData.raceDistance, label: "Race Distance" },
            { icon: Map, value: circuitData.trackType, label: "Track Type" },
            {
                icon: Timer,
                value: circuitData.lapRecord,
                label: "Lap Record",
                sub: circuitData.lapRecordHolder ? `${circuitData.lapRecordHolder} · ${circuitData.lapRecordYear}` : null,
            },
            { icon: CalendarDays, value: circuitData.firstGrandPrix, label: "First F1 Grand Prix" },
        ]
            .filter((e) => e.value !== undefined && e.value !== null)
            // A long string (track type, length/distance with the imperial
            // conversion in parentheses) reads better small than forced to
            // the same size as a short number like "58" — keeps every box
            // legible without ever breaking the grid.
            .map((e) => ({ ...e, long: String(e.value).length > 14 }))
        : [];

    return (
        <div className="rw rw-hq">
            {/* ── Weekend Header ──────────────────────────────────── */}
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
            </header>

            <main className="rw-hq-main">
                {/* ── Podium + Weekend Schedule (side-by-side) ──────── */}
                <HqSection eyebrow="CLASSIFICATION" title="Podium & Weekend Schedule">
                    <div className="rw-hq-hero-cols">
                        <div className="rw-hq-hero-main">
                            <span className="rw-hq-subeyebrow rw-mono">PODIUM</span>
                            {!raceNotStarted && results.length > 0 ? (
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
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="rw-hq-standby">
                                    <p>This race has not taken place yet.</p>
                                    <p>The podium and driver results will populate here once the race weekend is complete.</p>
                                </div>
                            )}
                        </div>

                        <div className="rw-schedule-card">
                            <span className="rw-schedule-title rw-mono">WEEKEND SCHEDULE</span>
                            <ol className="rw-schedule-list">
                                {sessions.map((s) => {
                                    const isNext = nextSession?.key === s.key;
                                    const isPast = s.start <= now && !isNext;
                                    const Icon = SESSION_ICONS[s.key] || Flag;
                                    return (
                                        <li
                                            key={s.key}
                                            className={`rw-schedule-row${isNext ? " rw-schedule-row--next" : ""}${isPast ? " rw-schedule-row--past" : ""}`}
                                        >
                                            <span className="rw-schedule-icon" aria-hidden="true">
                                                <Icon size={15} />
                                            </span>
                                            <span className="rw-schedule-name">
                                                {s.label}
                                                {isNext && <span className="rw-schedule-next-badge rw-mono">NEXT</span>}
                                            </span>
                                            <span className="rw-schedule-time rw-mono">
                                                {formatSessionTime(s.date, s.time)}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    </div>
                </HqSection>

                {!raceNotStarted && results.length > 0 && (
                    <>
                        {/* ── Complete Driver Results ───────────────── */}
                        <HqSection eyebrow="CLASSIFICATION" title="Driver Results">
                            <div className="rw-results-scroll">
                                <table className="rw-results-table">
                                    <thead>
                                        <tr>
                                            <th>Pos</th>
                                            <th>Driver</th>
                                            <th>Team</th>
                                            <th>{hasSprint ? "Quali / Sprint" : "Qualifying"}</th>
                                            <th>Grid</th>
                                            <th>Race Result</th>
                                            <th>Points</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((result) => {
                                            const q = qualiFor(result.Driver.driverId);
                                            const s = hasSprint ? sprintFor(result.Driver.driverId) : null;
                                            const dnf = result.status !== "Finished" && !result.status.startsWith("+");
                                            return (
                                                <tr key={result.position}>
                                                    <td className="rw-mono rw-results-pos">P{result.position}</td>
                                                    <td className="rw-results-name">
                                                        {result.Driver.givenName} <b>{result.Driver.familyName}</b>
                                                    </td>
                                                    <td className="rw-results-team">{result.Constructor.name}</td>
                                                    <td className="rw-mono rw-results-quali">
                                                        <span>{q ? `P${q.position}` : "—"}</span>
                                                        {hasSprint && (
                                                            <span className="rw-results-quali-sub">
                                                                {s ? `SPRINT P${s.position}` : "SPRINT —"}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="rw-mono">P{result.grid}</td>
                                                    <td className="rw-mono">
                                                        {dnf ? `DNF — ${result.status}` : result.status}
                                                    </td>
                                                    <td className="rw-mono">{result.points} PTS</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </HqSection>

                        {/* ── Race Highlights ────────────────────────── */}
                        <HqSection eyebrow="TELEMETRY" title="Race Highlights">
                            <div className="rw-highlights">
                                {qualifying.length > 0 && (
                                    <div className="rw-highlight">
                                        <span className="rw-highlight-label rw-mono">POLE POSITION</span>
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
                                        <span className="rw-highlight-label rw-mono">FASTEST LAP</span>
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

                        {/* ── Weekend Team Performance ──────────────── */}
                        <HqSection eyebrow="PIT WALL" title="Weekend Team Performance">
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

                {/* ── Circuit Essentials ─────────────────────────────── */}
                {essentials.length > 0 && (
                    <HqSection eyebrow="ENGINEERING" title="Circuit Essentials">
                        <div className="rw-essentials">
                            {essentials.map(({ icon: Icon, value, label, sub, long }) => (
                                <div className="rw-essential" key={label}>
                                    <span className="rw-essential-icon" aria-hidden="true"><Icon size={16} /></span>
                                    <span className={`rw-essential-value rw-mono${long ? " rw-essential-value--long" : ""}`}>
                                        <CountUp value={value} />
                                    </span>
                                    <span className="rw-essential-label rw-mono">{label}</span>
                                    {sub && <span className="rw-essential-sub rw-mono">{sub}</span>}
                                </div>
                            ))}
                        </div>
                    </HqSection>
                )}
            </main>
        </div>
    );
}

export default GrandPrixDetails;
