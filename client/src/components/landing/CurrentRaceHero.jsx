/*
 * CURRENT RACE HERO — the homepage's opening briefing.
 *
 * Shows whichever session is most relevant right now: LIVE (derived from the
 * official schedule — see findLiveSession) or the next upcoming session.
 * Typography carries the identity; the circuit drawing and weekend schedule
 * sit beside it as one composition rather than a separate decorative panel,
 * so the viewport reads as useful information immediately.
 */
import { Link } from "react-router-dom";
import { circuitInfo } from "../../data/circuitInfo";
import {
    formatWeekendRange,
    getWeekendSessions,
} from "../../utils/landingHelpers";
import useCountdown from "../../hooks/useCountdown";
import CircuitVisualization from "./CircuitVisualization";
import WeekendSchedule from "./WeekendSchedule";

function pad(n) {
    return String(n).padStart(2, "0");
}

export default function CurrentRaceHero({ liveSession, nextSession, scheduleError }) {
    const isLive = Boolean(liveSession);
    const session = liveSession || nextSession;
    const race = session?.race || null;
    const sessions = race ? getWeekendSessions(race) : [];
    const raceSession = sessions.find((s) => s.key === "Race");
    const countdown = useCountdown(!isLive && raceSession ? raceSession.start : null);
    const info = race ? circuitInfo[race.Circuit?.circuitId] : null;

    if (!race) {
        return (
            <section className="ch" aria-label="Current Grand Prix">
                <p className="ch-kicker">
                    <span className="ch-kicker-dot" aria-hidden="true" />
                    FORMULA 1 · {new Date().getFullYear()} SEASON
                </p>
                <h1 className="ch-title">ALL ABOUT F1</h1>
                <p className="ch-sub">
                    {scheduleError
                        ? "Season schedule unavailable right now."
                        : "Loading the season schedule…"}
                </p>
            </section>
        );
    }

    const raceLocation = race.raceName.replace(/ Grand Prix$/i, "");

    return (
        <section className="ch" aria-label="Current Grand Prix">
            <div className="ch-main">
                <p className="ch-kicker">
                    <span className="ch-kicker-dot" aria-hidden="true" />
                    FORMULA 1 · {race.season} SEASON
                </p>
                <span className={`ch-status${isLive ? " is-live" : ""}`}>
                    <i aria-hidden="true" />
                    {isLive ? `LIVE — ${session.label.toUpperCase()}` : `ROUND ${race.round}`}
                </span>

                <h1 className="ch-title">
                    <span className="ch-title-location">{raceLocation}</span>
                    <span className="ch-title-suffix">Grand Prix</span>
                </h1>

                <p className="ch-meta">
                    {race.Circuit?.circuitName?.toUpperCase()} · {formatWeekendRange(race)}
                </p>

                <div className="ch-row">
                    {!isLive && raceSession && countdown.total > 0 && (
                        <div
                            className="ch-countdown"
                            role="timer"
                            aria-label={`Race starts in ${countdown.days} days ${countdown.hours} hours ${countdown.minutes} minutes`}
                        >
                            {[
                                [countdown.days, "D"],
                                [countdown.hours, "H"],
                                [countdown.minutes, "M"],
                                [countdown.seconds, "S"],
                            ].map(([val, lbl]) => (
                                <span key={lbl}>
                                    <b>{pad(val)}</b>
                                    <small>{lbl}</small>
                                </span>
                            ))}
                        </div>
                    )}

                    <Link
                        to={`/grandprixdashboard/${race.season}/${race.round}`}
                        className="ch-cta"
                    >
                        {isLive ? "Follow the session" : "Enter race weekend"}
                        <span aria-hidden="true">→</span>
                    </Link>
                </div>
            </div>

            <aside className="ch-side">
                <CircuitVisualization
                    circuitId={race.Circuit?.circuitId}
                    circuitName={race.Circuit?.circuitName}
                    info={info}
                />
                <WeekendSchedule sessions={sessions} />
            </aside>
        </section>
    );
}
