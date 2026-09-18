/*
 * SEASON TIMELINE — the calendar as one horizontal, scrollable line rather
 * than a grid of cards. Each stop is a round number, GP name, country and
 * date; completed / current / upcoming are distinguished by opacity and a
 * single accent dot on the current round.
 */
import { Link } from "react-router-dom";

function raceStart(race) {
    if (!race?.date) return null;
    return race.time ? new Date(`${race.date}T${race.time}`) : new Date(`${race.date}T00:00:00`);
}

function formatDate(race) {
    const d = raceStart(race);
    if (!d) return "TBA";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase();
}

export default function SeasonTimeline({ races, focusRound }) {
    if (!races?.length) return null;
    const now = new Date();

    return (
        <section className="st" aria-label="Season calendar">
            <header className="lp-section-head">
                <div>
                    <span className="lp-section-eyebrow">{races[0]?.season || ""} CALENDAR</span>
                    <h2 className="lp-section-title">The Season</h2>
                </div>
                <Link to="/grandprixdashboard" className="lp-cta">
                    FULL RACE WEEKEND <span aria-hidden="true">→</span>
                </Link>
            </header>

            <ol className="st-track">
                {races.map((race) => {
                    const start = raceStart(race);
                    const isFocus = race.round === focusRound;
                    const isDone = !isFocus && start && start < now;
                    const state = isFocus ? "focus" : isDone ? "done" : "future";
                    return (
                        <li key={race.round} className={`st-stop st-stop--${state}`}>
                            <Link
                                to={`/grandprixdashboard/${race.season}/${race.round}`}
                                className="st-stop-link"
                            >
                                <span className="st-stop-round">{String(race.round).padStart(2, "0")}</span>
                                <span className="st-stop-dot" aria-hidden="true" />
                                <span className="st-stop-name">
                                    {race.Circuit?.Location?.country || race.raceName}
                                </span>
                                <span className="st-stop-date">{formatDate(race)}</span>
                            </Link>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
