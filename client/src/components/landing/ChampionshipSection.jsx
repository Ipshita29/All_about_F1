/*
 * THE TITLE FIGHT — a curated top 3, not a standings table. An accessible
 * DRIVERS | CONSTRUCTORS toggle switches which championship is shown;
 * "View Full Standings" hands off to the real roster page for the rest.
 *
 * P1 carries deliberately more visual weight than P2/P3 (a small
 * "Championship Leader" tag, larger typography, a stronger accent on its
 * points) — restrained, not a flashy card. No constructor colour bars:
 * the section follows the global black/white/red system rather than
 * borrowing team livery colours.
 */
import { useRef, useState } from "react";
import SectionHeader from "../ui/SectionHeader";
import Button from "../ui/Button";
import { isFavouriteDriver, isFavouriteTeam } from "../../utils/landingHelpers";

const VIEWS = [
    { id: "drivers", label: "DRIVERS" },
    { id: "constructors", label: "CONSTRUCTORS" },
];

export default function ChampionshipSection({ driverStandings, constructorStandings, favs }) {
    const [view, setView] = useState("drivers");
    const tabRefs = useRef([]);
    const isDrivers = view === "drivers";

    const onTabKeyDown = (e, index) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const next = (index + (e.key === "ArrowRight" ? 1 : VIEWS.length - 1)) % VIEWS.length;
        setView(VIEWS[next].id);
        tabRefs.current[next]?.focus();
    };

    const standings = (isDrivers ? driverStandings : constructorStandings) || [];
    const top3 = standings.slice(0, 3);
    const hasData = top3.length > 0;

    return (
        <section className="champ" aria-label="Championship standings">
            <div className="champ-head">
                <SectionHeader eyebrow="WORLD CHAMPIONSHIP" title="The Title Fight" />
                <div className="champ-toggle" role="tablist" aria-label="Championship type">
                    {VIEWS.map((v, i) => (
                        <button
                            key={v.id}
                            ref={(el) => (tabRefs.current[i] = el)}
                            role="tab"
                            aria-selected={view === v.id}
                            tabIndex={view === v.id ? 0 : -1}
                            className={`champ-tab${view === v.id ? " is-active" : ""}`}
                            onClick={() => setView(v.id)}
                            onKeyDown={(e) => onTabKeyDown(e, i)}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            </div>

            {!hasData ? (
                <p className="lp-inline-state">STANDINGS UNAVAILABLE</p>
            ) : (
                <ol className="champ-podium">
                    {top3.map((s, i) => {
                        const driver = isDrivers ? s.Driver : null;
                        const constructor = isDrivers ? s.Constructors?.[0] : s.Constructor;
                        const fav = isDrivers
                            ? isFavouriteDriver(favs, driver) || isFavouriteTeam(favs, constructor)
                            : isFavouriteTeam(favs, constructor);
                        const isLeader = i === 0;
                        return (
                            <li
                                key={isDrivers ? driver.driverId : constructor.constructorId}
                                className={`champ-spot${isLeader ? " champ-spot--leader" : ""}`}
                            >
                                <div className="champ-spot-top">
                                    <span className="champ-spot-pos">P{s.position}</span>
                                    {isLeader && <span className="champ-spot-tag">CHAMPIONSHIP LEADER</span>}
                                    {fav && <span className="champ-spot-fav">FAV</span>}
                                </div>

                                <h3 className="champ-spot-name">
                                    {isDrivers ? (
                                        <>{driver.givenName} <b>{driver.familyName}</b></>
                                    ) : (
                                        <b>{constructor.name}</b>
                                    )}
                                </h3>
                                <p className="champ-spot-team">
                                    {isDrivers ? constructor?.name : constructor.nationality}
                                </p>

                                <div className="champ-spot-pts">
                                    <span className="champ-spot-pts-value">{s.points}</span>
                                    <span className="champ-spot-pts-label">POINTS</span>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            <Button variant="secondary" to={isDrivers ? "/drivers" : "/teams"} arrow className="champ-more">
                View Full Standings
            </Button>
        </section>
    );
}
