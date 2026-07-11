/*
 * Race Center — the timing-screen section directly below the hero.
 *
 * Live state is derived purely from the official session schedule (Jolpica):
 * if "now" falls inside a scheduled session window we show LIVE, otherwise
 * the same board becomes the NEXT SESSION state with a countdown.
 *
 * There is no live-timing feed in this project (no OpenF1 backend route),
 * so during a live window the leaderboard shows the real championship
 * standings order and says so explicitly — nothing is presented as live
 * telemetry.
 */
import { Link } from "react-router-dom";
import { formatSessionTime } from "../../utils/timeUtils";
import {
    driverCode,
    getTeamColor,
    getWeekendSessions,
    isFavouriteDriver,
    isFavouriteTeam,
} from "../../utils/landingHelpers";
import useCountdown from "../../hooks/useCountdown";

function pad(n) {
    return String(n).padStart(2, "0");
}

function TimingBoard({ driverStandings, favs, caption }) {
    if (!driverStandings?.length) {
        return <p className="lp-rc-empty">STANDINGS DATA UNAVAILABLE</p>;
    }
    return (
        <div className="lp-rc-board" role="table" aria-label="Driver order">
            <div className="lp-rc-row lp-rc-row--head" role="row">
                <span role="columnheader" className="lp-rc-pos">POS</span>
                <span role="columnheader" className="lp-rc-drv">DRIVER</span>
                <span role="columnheader" className="lp-rc-team">TEAM</span>
                <span role="columnheader" className="lp-rc-num">PTS</span>
            </div>
            {driverStandings.slice(0, 10).map((s) => {
                const fav =
                    isFavouriteDriver(favs, s.Driver) ||
                    isFavouriteTeam(favs, s.Constructors?.[0]);
                const color = getTeamColor(s.Constructors?.[0]?.constructorId);
                return (
                    <div
                        key={s.Driver.driverId}
                        className={`lp-rc-row${fav ? " lp-rc-row--fav" : ""}`}
                        role="row"
                        style={fav && favs.teamColor ? { "--fav-color": favs.teamColor } : undefined}
                    >
                        <span role="cell" className="lp-rc-pos">{s.position}</span>
                        <span role="cell" className="lp-rc-drv">
                            <i
                                className="lp-rc-strip"
                                style={color ? { background: color } : undefined}
                                aria-hidden="true"
                            />
                            <b>{driverCode(s.Driver)}</b>
                            <em className="lp-rc-fullname">
                                {s.Driver.givenName} {s.Driver.familyName}
                            </em>
                            {fav && <span className="lp-rc-favtag">FAV</span>}
                        </span>
                        <span role="cell" className="lp-rc-team">{s.Constructors?.[0]?.name || "—"}</span>
                        <span role="cell" className="lp-rc-num">{s.points}</span>
                    </div>
                );
            })}
            <p className="lp-rc-caption">{caption}</p>
        </div>
    );
}

function ScheduleList({ race, highlightKey }) {
    const sessions = getWeekendSessions(race);
    const now = new Date();
    return (
        <ul className="lp-rc-schedule" aria-label="Race weekend schedule">
            {sessions.map((s) => {
                const done = s.start < now && s.key !== highlightKey;
                return (
                    <li
                        key={s.key}
                        className={`lp-rc-schedule-row${done ? " is-done" : ""}${
                            s.key === highlightKey ? " is-next" : ""
                        }`}
                    >
                        <span className="lp-rc-schedule-name">{s.label}</span>
                        <span className="lp-rc-schedule-time">
                            {formatSessionTime(s.date, s.time)}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

export default function LiveRaceCenter({
    liveSession,
    nextSession,
    driverStandings,
    favs,
    scheduleError,
}) {
    const isLive = Boolean(liveSession);
    const session = liveSession || nextSession;
    const race = session?.race;
    const countdown = useCountdown(!isLive && nextSession ? nextSession.start : null);

    return (
        <section className="lp-section lp-rc" id="race-center" aria-label="Race center">
            <div className="lp-rc-topbar">
                <span className={`lp-rc-status${isLive ? " lp-rc-status--live" : ""}`}>
                    <i className="lp-rc-dot" aria-hidden="true" />
                    {isLive ? "LIVE" : "NEXT SESSION"}
                </span>
                {race && (
                    <span className="lp-rc-gpname">
                        {race.raceName?.toUpperCase()} — {session.label.toUpperCase()}
                    </span>
                )}
                <span className="lp-rc-utc">
                    RD {race?.round || "--"} / {race?.season || "----"}
                </span>
            </div>

            {!race && (
                <div className="lp-rc-body lp-rc-body--empty">
                    <p className="lp-rc-empty">
                        {scheduleError
                            ? "SESSION SCHEDULE UNAVAILABLE — COULD NOT REACH THE TIMING SERVER"
                            : "NO FURTHER SESSIONS SCHEDULED THIS SEASON"}
                    </p>
                    <Link to="/grandprixdashboard" className="lp-cta">
                        BROWSE THE RACE ARCHIVE <span aria-hidden="true">→</span>
                    </Link>
                </div>
            )}

            {race && isLive && (
                <div className="lp-rc-body">
                    <div className="lp-rc-main">
                        <TimingBoard
                            driverStandings={driverStandings}
                            favs={favs}
                            caption="CHAMPIONSHIP STANDINGS ORDER — LIVE TIMING FEED NOT CONNECTED"
                        />
                    </div>
                    <aside className="lp-rc-side">
                        <h3 className="lp-rc-side-label">SESSION</h3>
                        <p className="lp-rc-side-value">{session.label.toUpperCase()}</p>
                        <h3 className="lp-rc-side-label">SCHEDULED WINDOW</h3>
                        <p className="lp-rc-side-value lp-mono">
                            {formatSessionTime(session.date, session.time)}
                        </p>
                        <h3 className="lp-rc-side-label">RACE CONTROL</h3>
                        <p className="lp-rc-side-note">MESSAGE FEED NOT CONNECTED</p>
                        <Link to="/grandprixdashboard" className="lp-cta">
                            ENTER RACE CENTER <span aria-hidden="true">→</span>
                        </Link>
                    </aside>
                </div>
            )}

            {race && !isLive && (
                <div className="lp-rc-body">
                    <div className="lp-rc-main">
                        <p className="lp-rc-nextname">{race.raceName}</p>
                        <p className="lp-rc-nextsession">
                            {session.label.toUpperCase()} ·{" "}
                            {formatSessionTime(session.date, session.time)}
                        </p>
                        <div
                            className="lp-rc-countdown lp-mono"
                            role="timer"
                            aria-label={`${session.label} starts in ${countdown.days} days ${countdown.hours} hours ${countdown.minutes} minutes`}
                        >
                            <span>
                                <b>{pad(countdown.days)}</b>
                                <small>DAYS</small>
                            </span>
                            <span className="lp-rc-colon" aria-hidden="true">:</span>
                            <span>
                                <b>{pad(countdown.hours)}</b>
                                <small>HRS</small>
                            </span>
                            <span className="lp-rc-colon" aria-hidden="true">:</span>
                            <span>
                                <b>{pad(countdown.minutes)}</b>
                                <small>MIN</small>
                            </span>
                            <span className="lp-rc-colon" aria-hidden="true">:</span>
                            <span>
                                <b>{pad(countdown.seconds)}</b>
                                <small>SEC</small>
                            </span>
                        </div>
                        <Link to="/grandprixdashboard" className="lp-cta">
                            ENTER RACE CENTER <span aria-hidden="true">→</span>
                        </Link>
                    </div>
                    <aside className="lp-rc-side">
                        <h3 className="lp-rc-side-label">WEEKEND SCHEDULE</h3>
                        <ScheduleList race={race} highlightKey={session.key} />
                    </aside>
                </div>
            )}
        </section>
    );
}
