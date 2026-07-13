import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import GarageCard from "../components/entity/GarageCard";
import LoadingSpinner from "../components/LoadingSpinner";
import "./EntityPages.css";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

/*
 * PIT LANE — the teams page as a walk past the garages.
 * Every constructor is a garage bay: the car waits behind a shutter door
 * that winches up on hover, and clicking walks inside (shared element
 * transition into Team Details). Constructor standings supply position and
 * points; driver standings supply each garage's current line-up.
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

    /* walk the pit lane in championship order when standings are known */
    const positionOf = (t) => {
        const s = standings.find((s) => s.Constructor.constructorId === t.constructorId);
        return s ? Number(s.position) : 99;
    };
    const ordered = [...filtered].sort((a, b) => positionOf(a) - positionOf(b));

    return (
        <div className="ex ex-pitlane-page">
            <header className="ex-hero">
                <span className="ex-hero-eyebrow">Formula 1 · {year} Season</span>
                <h1 className="ex-hero-title">Pit Lane</h1>
                <p className="ex-hero-sub">
                    10 Constructors. Countless Hours of Engineering. One Goal.
                </p>
                <div className="ex-hero-rule" aria-hidden="true" />

                <div className="ex-controls">
                    <label className="ex-field">
                        <span className="ex-field-label">SEASON</span>
                        <select value={year} onChange={(e) => setYear(e.target.value)}>
                            {YEARS.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </label>
                    <label className="ex-field">
                        <span className="ex-field-label">LOCATE</span>
                        <input
                            type="text"
                            placeholder="Team name…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </label>
                    <span className="ex-count">
                        {filtered.length} GARAGE{filtered.length !== 1 ? "S" : ""} OPEN
                    </span>
                    <Link to="/compare-teams" className="ex-cta">
                        Constructor Battle →
                    </Link>
                </div>
            </header>

            {!loaded ? (
                <div className="ex-loading"><LoadingSpinner /></div>
            ) : (
                <main className="ex-main">
                    {ordered.length === 0 ? (
                        <div className="ex-empty">
                            <span className="ex-empty-title">Pit lane is empty</span>
                            <span className="ex-empty-sub">ADJUST THE SEASON OR SEARCH</span>
                        </div>
                    ) : (
                        <div className="ex-pitlane">
                            {ordered.map((t) => {
                                const standing = standings.find(
                                    (s) => s.Constructor.constructorId === t.constructorId
                                );
                                const drivers = driverStandings.filter(
                                    (d) => d.Constructors?.[0]?.constructorId === t.constructorId
                                );
                                return (
                                    <Link
                                        key={t.constructorId}
                                        to={`/teams/${year}/${t.constructorId}`}
                                        viewTransition
                                        className="ex-garage-link"
                                        aria-label={`${t.name} — enter garage`}
                                    >
                                        <GarageCard
                                            team={t}
                                            standing={standing}
                                            drivers={drivers}
                                        />
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </main>
            )}
        </div>
    );
}

export default Teams;
