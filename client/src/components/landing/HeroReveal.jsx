/*
 * Homepage hero — typography and live data, not an image.
 *
 * Shows whichever session is most relevant right now: LIVE (derived from the
 * official schedule — see findLiveSession) or the next upcoming session,
 * with the full weekend schedule and a countdown to lights out. A small
 * circuit blueprint keeps the "no photography required" data language
 * consistent with the Race Weekend pages.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { formatSessionTime } from "../../utils/timeUtils";
import {
    circuitMapCandidates,
    formatWeekendRange,
    getWeekendSessions,
} from "../../utils/landingHelpers";
import useCountdown from "../../hooks/useCountdown";

function pad(n) {
    return String(n).padStart(2, "0");
}

function BlueprintFallback() {
    return (
        <svg viewBox="0 0 300 180" className="lp-hero-blueprint-svg" aria-hidden="true">
            <path
                d="M40 140 L60 60 Q64 44 80 44 L150 50 Q170 52 180 38 Q188 26 204 30
                   L250 44 Q266 49 260 66 L236 120 Q230 136 214 136 L70 152
                   Q48 154 40 140 Z"
                fill="none"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="5 7"
            />
        </svg>
    );
}

function CircuitBlueprint({ circuitId }) {
    const [tier, setTier] = useState(0);
    const candidates = circuitMapCandidates(circuitId);
    const src = candidates[tier];
    if (!src) return <BlueprintFallback />;
    return (
        <img
            src={src}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="lp-hero-blueprint-img"
            onError={() => setTier((t) => t + 1)}
        />
    );
}

export default function HeroReveal({ liveSession, nextSession, scheduleError }) {
    const isLive = Boolean(liveSession);
    const session = liveSession || nextSession;
    const race = session?.race || null;
    const sessions = race ? getWeekendSessions(race) : [];
    const raceSession = sessions.find((s) => s.key === "Race");
    const countdown = useCountdown(!isLive && raceSession ? raceSession.start : null);
    const now = new Date();

    return (
        <section className="lp-hero" aria-label="Current Grand Prix">
            <div className="lp-hero-grid" aria-hidden="true" />

            <div className="lp-hero-inner">
                <div className="lp-hero-main">
                    <p className="lp-hero-kicker">
                        <span className="lp-hero-kicker-dot" aria-hidden="true" />
                        FORMULA 1 · {race?.season || new Date().getFullYear()} SEASON
                    </p>

                    {!race ? (
                        <>
                            <h1 className="lp-hero-title">ALL ABOUT F1</h1>
                            <p className="lp-hero-sub">
                                {scheduleError
                                    ? "Season schedule unavailable right now."
                                    : "Loading the season schedule…"}
                            </p>
                        </>
                    ) : (
                        <>
                            <span className={`lp-hero-status${isLive ? " is-live" : ""}`}>
                                <i aria-hidden="true" />
                                {isLive ? `LIVE — ${session.label.toUpperCase()}` : "NEXT GRAND PRIX"}
                            </span>

                            <h1 className="lp-hero-title">{race.raceName}</h1>

                            <p className="lp-hero-meta">
                                ROUND {race.round} · {race.Circuit?.circuitName?.toUpperCase()} ·{" "}
                                {race.Circuit?.Location?.country?.toUpperCase()} ·{" "}
                                {formatWeekendRange(race)}
                            </p>

                            {!isLive && raceSession && countdown.total > 0 && (
                                <div
                                    className="lp-hero-countdown"
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
                                className="lp-hero-cta"
                            >
                                {isLive ? "Follow the session" : "Enter race weekend"}
                                <span aria-hidden="true">→</span>
                            </Link>
                        </>
                    )}
                </div>

                {race && (
                    <aside className="lp-hero-side">
                        <div className="lp-hero-blueprint">
                            <CircuitBlueprint circuitId={race.Circuit?.circuitId} />
                        </div>
                        <div className="lp-hero-schedule">
                            <span className="lp-hero-schedule-label">WEEKEND SCHEDULE</span>
                            <ul>
                                {sessions.map((s) => (
                                    <li key={s.key} className={s.start < now ? "is-done" : ""}>
                                        <span>{s.label}</span>
                                        <span>{formatSessionTime(s.date, s.time)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>
                )}
            </div>
        </section>
    );
}
