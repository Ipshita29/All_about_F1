/*
 * One spacious championship section with an accessible DRIVERS | CONSTRUCTORS
 * toggle (tab pattern). Hierarchy comes from typography and real data — big
 * ghost driver numbers, points, and the gap to P1 — not progress bars.
 *
 * Constructor rows reserve a slot for a local car asset
 * (/cars/<constructorId>.png, see ASSETS_REQUIRED.md); when the asset is
 * missing the row simply renders without it.
 */
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    getTeamColor,
    isFavouriteDriver,
    isFavouriteTeam,
    pointsToLeader,
} from "../../utils/landingHelpers";

const VIEWS = [
    { id: "drivers", label: "DRIVERS" },
    { id: "constructors", label: "CONSTRUCTORS" },
];

function TeamCarImage({ constructorId }) {
    const [failed, setFailed] = useState(false);
    if (!constructorId || failed) return null;
    return (
        <img
            className="lp-champ-car"
            src={`/cars/${constructorId}.png`}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
}

export default function ChampionshipSection({ driverStandings, constructorStandings, favs }) {
    const [view, setView] = useState("drivers");
    const tabRefs = useRef([]);

    const onTabKeyDown = (e, index) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const next = (index + (e.key === "ArrowRight" ? 1 : VIEWS.length - 1)) % VIEWS.length;
        setView(VIEWS[next].id);
        tabRefs.current[next]?.focus();
    };

    const driverLeaderPts = driverStandings?.[0]?.points ?? 0;
    const teamLeaderPts = constructorStandings?.[0]?.points ?? 0;
    const hasDrivers = driverStandings?.length > 0;
    const hasTeams = constructorStandings?.length > 0;

    return (
        <section className="lp-section lp-champ" aria-label="Championship standings">
            <header className="lp-section-head lp-champ-head">
                <div>
                    <span className="lp-section-eyebrow">WORLD CHAMPIONSHIP</span>
                    <h2 className="lp-section-title">THE TITLE FIGHT</h2>
                </div>
                <div className="lp-champ-toggle" role="tablist" aria-label="Championship type">
                    {VIEWS.map((v, i) => (
                        <button
                            key={v.id}
                            ref={(el) => (tabRefs.current[i] = el)}
                            role="tab"
                            id={`lp-champ-tab-${v.id}`}
                            aria-selected={view === v.id}
                            aria-controls={`lp-champ-panel-${v.id}`}
                            tabIndex={view === v.id ? 0 : -1}
                            className={`lp-champ-tab${view === v.id ? " is-active" : ""}`}
                            onClick={() => setView(v.id)}
                            onKeyDown={(e) => onTabKeyDown(e, i)}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            </header>

            <div
                role="tabpanel"
                id="lp-champ-panel-drivers"
                aria-labelledby="lp-champ-tab-drivers"
                hidden={view !== "drivers"}
            >
                {!hasDrivers && (
                    <p className="lp-inline-state lp-mono">DRIVER STANDINGS UNAVAILABLE</p>
                )}
                <ol className="lp-champ-list">
                    {(driverStandings || []).slice(0, 10).map((s) => {
                        const fav =
                            isFavouriteDriver(favs, s.Driver) ||
                            isFavouriteTeam(favs, s.Constructors?.[0]);
                        const color = getTeamColor(s.Constructors?.[0]?.constructorId);
                        return (
                            <li
                                key={s.Driver.driverId}
                                className={`lp-champ-row${fav ? " lp-champ-row--fav" : ""}`}
                                style={fav && favs.teamColor ? { "--fav-color": favs.teamColor } : undefined}
                            >
                                <span className="lp-champ-ghostnum lp-mono" aria-hidden="true">
                                    {s.Driver.permanentNumber || s.position}
                                </span>
                                <span className="lp-champ-pos lp-mono">{s.position}</span>
                                <span
                                    className="lp-champ-strip"
                                    style={color ? { background: color } : undefined}
                                    aria-hidden="true"
                                />
                                <span className="lp-champ-name">
                                    {s.Driver.givenName}{" "}
                                    <b>{s.Driver.familyName?.toUpperCase()}</b>
                                    {fav && <span className="lp-champ-favtag">FAV</span>}
                                </span>
                                <span className="lp-champ-team">{s.Constructors?.[0]?.name}</span>
                                <span className="lp-champ-gap lp-mono">
                                    {pointsToLeader(s.points, driverLeaderPts)}
                                </span>
                                <span className="lp-champ-pts lp-mono">
                                    {s.points}
                                    <small> PTS</small>
                                </span>
                            </li>
                        );
                    })}
                </ol>
                {hasDrivers && (
                    <Link to="/drivers" className="lp-cta lp-champ-more">
                        FULL DRIVER STANDINGS <span aria-hidden="true">→</span>
                    </Link>
                )}
            </div>

            <div
                role="tabpanel"
                id="lp-champ-panel-constructors"
                aria-labelledby="lp-champ-tab-constructors"
                hidden={view !== "constructors"}
            >
                {!hasTeams && (
                    <p className="lp-inline-state lp-mono">CONSTRUCTOR STANDINGS UNAVAILABLE</p>
                )}
                <ol className="lp-champ-list">
                    {(constructorStandings || []).map((s) => {
                        const fav = isFavouriteTeam(favs, s.Constructor);
                        const color = getTeamColor(s.Constructor?.constructorId);
                        return (
                            <li
                                key={s.Constructor.constructorId}
                                className={`lp-champ-row lp-champ-row--team${
                                    fav ? " lp-champ-row--fav" : ""
                                }`}
                                style={fav && favs.teamColor ? { "--fav-color": favs.teamColor } : undefined}
                            >
                                <span className="lp-champ-pos lp-mono">{s.position}</span>
                                <span
                                    className="lp-champ-strip"
                                    style={color ? { background: color } : undefined}
                                    aria-hidden="true"
                                />
                                <span className="lp-champ-name">
                                    <b>{s.Constructor.name?.toUpperCase()}</b>
                                    {fav && <span className="lp-champ-favtag">FAV</span>}
                                </span>
                                <span className="lp-champ-gap lp-mono">
                                    {pointsToLeader(s.points, teamLeaderPts)}
                                </span>
                                <span className="lp-champ-pts lp-mono">
                                    {s.points}
                                    <small> PTS</small>
                                </span>
                                <TeamCarImage constructorId={s.Constructor.constructorId} />
                            </li>
                        );
                    })}
                </ol>
                {hasTeams && (
                    <Link to="/teams" className="lp-cta lp-champ-more">
                        FULL CONSTRUCTOR STANDINGS <span aria-hidden="true">→</span>
                    </Link>
                )}
            </div>
        </section>
    );
}
