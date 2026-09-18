/*
 * One spacious championship section with an accessible DRIVERS | CONSTRUCTORS
 * toggle (tab pattern). Hierarchy comes from typography and real data — big
 * ghost driver numbers, points, and the gap to P1 — not progress bars or
 * imagery.
 */
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import ChampionshipTable from "./ChampionshipTable";

const VIEWS = [
    { id: "drivers", label: "DRIVERS" },
    { id: "constructors", label: "CONSTRUCTORS" },
];

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
                {hasDrivers && (
                    <ChampionshipTable
                        variant="drivers"
                        standings={(driverStandings || []).slice(0, 10)}
                        leaderPts={driverLeaderPts}
                        favs={favs}
                    />
                )}
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
                {hasTeams && (
                    <ChampionshipTable
                        variant="constructors"
                        standings={constructorStandings || []}
                        leaderPts={teamLeaderPts}
                        favs={favs}
                    />
                )}
                {hasTeams && (
                    <Link to="/teams" className="lp-cta lp-champ-more">
                        FULL CONSTRUCTOR STANDINGS <span aria-hidden="true">→</span>
                    </Link>
                )}
            </div>
        </section>
    );
}
