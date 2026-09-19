import { useState, useEffect } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchControls from "../components/entity/SearchControls";
import ComparisonCTA from "../components/entity/ComparisonCTA";
import ConstructorRoster from "../components/entity/ConstructorRoster";
import ConstructorProfile from "../components/entity/ConstructorProfile";
import { getTeamAssets } from "../config/teamAssets";
import "./EntityPages.css";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

/*
 * THE CONSTRUCTORS — a championship dossier, not a database table. Each
 * team is an entity: position, nationality, current line-up (by driver
 * number), points and wins as statistics, and a proportional bar showing
 * real standing relative to the championship leader.
 */
function Teams() {
    const [teams, setTeams] = useState([]);
    const [loadedYear, setLoadedYear] = useState(null);
    const [standings, setStandings] = useState([]);
    const [driverStandings, setDriverStandings] = useState([]);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState("2026");
    const loaded = loadedYear === year;

    useEffect(() => {
        fetch(`http://localhost:3000/teams/${year}`)
            .then((res) => res.json())
            .then((data) => {
                setTeams(Array.isArray(data) ? data : []);
                setLoadedYear(year);
            });
    }, [year]);

    useEffect(() => {
        fetch(`http://localhost:3000/teams/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setStandings(Array.isArray(data) ? data : []))
            .catch(() => setStandings([]));
    }, [year]);

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setDriverStandings(Array.isArray(data) ? data : []))
            .catch(() => setDriverStandings([]));
    }, [year]);

    const filtered = teams.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    const positionOf = (t) => {
        const s = standings.find((s) => s.Constructor.constructorId === t.constructorId);
        return s ? Number(s.position) : 99;
    };
    const ordered = [...filtered].sort((a, b) => positionOf(a) - positionOf(b));
    const leaderPts = standings[0]?.points;

    return (
        <div className="ex">
            <header className="dr-hero">
                <span className="dr-hero-year">{year} SEASON</span>
                <h1 className="dr-hero-title">The Constructors</h1>
                <p className="dr-hero-sub">
                    {loaded ? teams.length : "10"} teams. One championship.
                </p>
            </header>

            <SearchControls
                year={year}
                years={YEARS}
                onYearChange={setYear}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="SEARCH TEAMS"
                count={`${filtered.length} TEAMS`}
            >
                <ComparisonCTA to="/compare-teams" label="Compare Constructors" />
            </SearchControls>

            {!loaded ? (
                <div className="ex-loading"><LoadingSpinner /></div>
            ) : ordered.length === 0 ? (
                <main className="ex-main">
                    <div className="ex-empty">
                        <span className="ex-empty-title">No team matches</span>
                        <span className="ex-empty-sub">ADJUST THE SEASON OR SEARCH</span>
                    </div>
                </main>
            ) : (
                <main className="ex-main">
                    <ConstructorRoster>
                        {ordered.map((t) => {
                            const standing = standings.find(
                                (s) => s.Constructor.constructorId === t.constructorId
                            );
                            const drivers = driverStandings.filter(
                                (d) => d.Constructors?.[0]?.constructorId === t.constructorId
                            );
                            return (
                                <ConstructorProfile
                                    key={t.constructorId}
                                    team={t}
                                    standing={standing}
                                    drivers={drivers}
                                    year={year}
                                    accent={getTeamAssets(t.constructorId).accent}
                                    leaderPts={leaderPts}
                                />
                            );
                        })}
                    </ConstructorRoster>
                </main>
            )}
        </div>
    );
}

export default Teams;
