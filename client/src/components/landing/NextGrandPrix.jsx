/*
 * NEXT GRAND PRIX — a premium race announcement, not a dashboard card.
 * Sits on a light Cararra surface directly under the dark hero for
 * strong contrast. Shows whichever session is most relevant right now:
 * LIVE (derived from the official schedule) or the next upcoming one.
 */
import Button from "../ui/Button";
import { formatWeekendRange, getWeekendSessions } from "../../utils/landingHelpers";
import useCountdown from "../../hooks/useCountdown";

function pad(n) {
    return String(n).padStart(2, "0");
}

export default function NextGrandPrix({ liveSession, nextSession, scheduleError }) {
    const isLive = Boolean(liveSession);
    const session = liveSession || nextSession;
    const race = session?.race || null;
    const sessions = race ? getWeekendSessions(race) : [];
    const raceSession = sessions.find((s) => s.key === "Race");
    const countdown = useCountdown(!isLive && raceSession ? raceSession.start : null);

    return (
        <section id="next-grand-prix" className="next-gp" aria-label="Next Grand Prix">
            <div className="next-gp-inner">
                <span className="next-gp-eyebrow">
                    {isLive ? `LIVE — ${session.label.toUpperCase()}` : "NEXT GRAND PRIX"}
                </span>

                {!race ? (
                    <p className="next-gp-empty">
                        {scheduleError
                            ? "Season schedule unavailable right now."
                            : "Loading the season schedule…"}
                    </p>
                ) : (
                    <>
                        <h2 className="next-gp-title">{race.raceName}</h2>
                        <p className="next-gp-meta">
                            ROUND {race.round} · {race.season} — {race.Circuit?.circuitName}
                        </p>
                        <p className="next-gp-range">{formatWeekendRange(race)}</p>

                        {!isLive && raceSession && countdown.total > 0 && (
                            <div
                                className="next-gp-countdown"
                                role="timer"
                                aria-label={`Race starts in ${countdown.days} days ${countdown.hours} hours ${countdown.minutes} minutes`}
                            >
                                {[
                                    [countdown.days, "DAYS"],
                                    [countdown.hours, "HRS"],
                                    [countdown.minutes, "MIN"],
                                ].map(([val, lbl]) => (
                                    <span key={lbl}>
                                        <b>{pad(val)}</b>
                                        <small>{lbl}</small>
                                    </span>
                                ))}
                            </div>
                        )}

                        <Button
                            variant="dark"
                            to={`/grandprixdashboard/${race.season}/${race.round}`}
                            arrow
                        >
                            {isLive ? "Follow The Session" : "Enter Race HQ"}
                        </Button>
                    </>
                )}
            </div>
        </section>
    );
}
