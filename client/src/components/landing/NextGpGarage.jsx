/*
 * "NEXT ON THE CALENDAR" — the upcoming Grand Prix presented as an F1
 * garage: engineering grid surface, circuit blueprint, session schedule and
 * a large race-day countdown. Garage lights switch on once when the section
 * scrolls into view (IntersectionObserver, CSS transition).
 */
import { Link } from "react-router-dom";
import { useState } from "react";
import { formatSessionTime } from "../../utils/timeUtils";
import {
    circuitMapSrc,
    formatWeekendRange,
    getWeekendSessions,
} from "../../utils/landingHelpers";
import useCountdown from "../../hooks/useCountdown";
import useInViewOnce from "../../hooks/useInViewOnce";

function pad(n) {
    return String(n).padStart(2, "0");
}

/* Generic blueprint track outline shown when no circuit map asset exists */
function BlueprintFallback() {
    return (
        <svg viewBox="0 0 300 180" className="lp-garage-blueprint" aria-hidden="true">
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

export default function NextGpGarage({ race }) {
    const [ref, inView] = useInViewOnce({ threshold: 0.3 });
    const [mapFailed, setMapFailed] = useState(false);

    const sessions = race ? getWeekendSessions(race) : [];
    const raceSession = sessions.find((s) => s.key === "Race");
    const countdown = useCountdown(raceSession?.start || null);

    if (!race) return null;

    const mapSrc = circuitMapSrc(race.Circuit?.circuitId);

    return (
        <section
            ref={ref}
            className={`lp-section lp-garage${inView ? " lp-garage--lit" : ""}`}
            aria-label="Next Grand Prix"
        >
            <div className="lp-garage-lights" aria-hidden="true">
                <span /><span /><span />
            </div>

            <header className="lp-section-head">
                <span className="lp-section-eyebrow">NEXT ON THE CALENDAR</span>
                <h2 className="lp-section-title">{race.raceName}</h2>
                <p className="lp-garage-meta lp-mono">
                    ROUND {race.round} · {race.Circuit?.circuitName?.toUpperCase()} ·{" "}
                    {race.Circuit?.Location?.locality?.toUpperCase()},{" "}
                    {race.Circuit?.Location?.country?.toUpperCase()} ·{" "}
                    {formatWeekendRange(race)}
                </p>
            </header>

            <div className="lp-garage-body">
                <div className="lp-garage-map">
                    {mapSrc && !mapFailed ? (
                        <img
                            src={mapSrc}
                            alt={`${race.Circuit?.circuitName} track layout`}
                            loading="lazy"
                            onError={() => setMapFailed(true)}
                        />
                    ) : (
                        <BlueprintFallback />
                    )}
                    <span className="lp-garage-map-label lp-mono">
                        CIRCUIT BLUEPRINT — {race.Circuit?.circuitId?.toUpperCase()}
                    </span>
                </div>

                <div className="lp-garage-panel">
                    {raceSession && countdown.total > 0 && (
                        <div
                            className="lp-garage-countdown lp-mono"
                            role="timer"
                            aria-label={`Race starts in ${countdown.days} days ${countdown.hours} hours ${countdown.minutes} minutes ${countdown.seconds} seconds`}
                        >
                            {[
                                [countdown.days, "DAYS"],
                                [countdown.hours, "HOURS"],
                                [countdown.minutes, "MINUTES"],
                                [countdown.seconds, "SECONDS"],
                            ].map(([val, lbl]) => (
                                <span className="lp-garage-count-unit" key={lbl}>
                                    <b>{pad(val)}</b>
                                    <small>{lbl}</small>
                                </span>
                            ))}
                        </div>
                    )}

                    <ul className="lp-garage-sessions" aria-label="Session schedule">
                        {sessions.map((s) => (
                            <li key={s.key} className="lp-garage-session-row">
                                <span className="lp-garage-session-name">{s.label}</span>
                                <span className="lp-garage-session-time lp-mono">
                                    {formatSessionTime(s.date, s.time)}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <Link
                        to={`/grandprixdashboard/${race.season}/${race.round}`}
                        className="lp-cta"
                    >
                        OPEN GRAND PRIX DETAILS <span aria-hidden="true">→</span>
                    </Link>
                </div>
            </div>
        </section>
    );
}
