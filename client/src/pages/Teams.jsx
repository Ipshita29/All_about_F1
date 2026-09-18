import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import { getTeamAssets } from "../config/teamAssets";
import "./EntityPages.css";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

/*
 * CONSTRUCTORS — every team as one clean, numbered standings list, ordered
 * by championship position. Team, points, wins and current line-up —
 * no car photography required.
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

    return (
        <div className="ex">
            <header className="ex-hero">
                <span className="ex-hero-eyebrow">Formula 1 · {year} Season</span>
                <h1 className="ex-hero-title">Constructors</h1>
                <p className="ex-hero-sub">10 Teams. One Championship.</p>
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
                    <span className="ex-count">{filtered.length} TEAMS</span>
                    <Link to="/compare-teams" className="ex-cta">
                        Compare Constructors →
                    </Link>
                </div>
            </header>

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
                    <ol className="ex-rows">
                        {ordered.map((t) => {
                            const standing = standings.find(
                                (s) => s.Constructor.constructorId === t.constructorId
                            );
                            const drivers = driverStandings.filter(
                                (d) => d.Constructors?.[0]?.constructorId === t.constructorId
                            );
                            const assets = getTeamAssets(t.constructorId);
                            return (
                                <li key={t.constructorId}>
                                    <Link
                                        to={`/teams/${year}/${t.constructorId}`}
                                        viewTransition
                                        className="ex-row"
                                        style={{ "--accent": assets.accent }}
                                    >
                                        <span className="ex-row-pos">
                                            {standing ? String(standing.position).padStart(2, "0") : "—"}
                                        </span>
                                        <span className="ex-row-team ex-row-team--main">
                                            <i className="ex-row-swatch" aria-hidden="true" />
                                            <b>{t.name}</b>
                                        </span>
                                        <span className="ex-row-nat">{t.nationality}</span>
                                        <span className="ex-row-drivers">
                                            {drivers.map((d) => d.Driver.familyName).join(" · ") || "—"}
                                        </span>
                                        <span className="ex-row-stat">
                                            <b>{standing?.points ?? "—"}</b><small>PTS</small>
                                        </span>
                                        <span className="ex-row-stat">
                                            <b>{standing?.wins ?? "—"}</b><small>WINS</small>
                                        </span>
                                        <span className="ex-row-arrow" aria-hidden="true">→</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ol>
                </main>
            )}
        </div>
    );
}

export default Teams;
