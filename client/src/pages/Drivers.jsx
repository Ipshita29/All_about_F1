import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import { getTeamAccent } from "../config/driverAssets";
import "./EntityPages.css";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

/*
 * THE GRID — every driver as one clean, numbered standings list.
 * Position, number, name, nationality, team and season stats — typography
 * carries the hierarchy, not photography. Selecting a row opens the Driver
 * Dossier via a shared-element view transition on the racing number.
 */
function Drivers() {
    const [drivers, setDrivers] = useState([]);
    const [loadedYear, setLoadedYear] = useState(null);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState("2026");
    const loaded = loadedYear === year;

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/standings/${year}`)
            .then((res) => res.json())
            .then((data) => {
                setDrivers(Array.isArray(data) ? data : []);
                setLoadedYear(year);
            });
    }, [year]);

    const filtered = drivers.filter((d) =>
        `${d.Driver.givenName} ${d.Driver.familyName}`
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    return (
        <div className="ex">
            <header className="ex-hero">
                <span className="ex-hero-eyebrow">Formula 1 · {year} Season</span>
                <h1 className="ex-hero-title">Drivers</h1>
                <p className="ex-hero-sub">20 Drivers. One Championship.</p>
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
                            placeholder="Driver name…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </label>
                    <span className="ex-count">{filtered.length} ON GRID</span>
                    <Link to="/compare-drivers" className="ex-cta">
                        Compare Drivers →
                    </Link>
                </div>
            </header>

            {!loaded ? (
                <div className="ex-loading"><LoadingSpinner /></div>
            ) : filtered.length === 0 ? (
                <main className="ex-main">
                    <div className="ex-empty">
                        <span className="ex-empty-title">No driver on this grid</span>
                        <span className="ex-empty-sub">ADJUST THE SEASON OR SEARCH</span>
                    </div>
                </main>
            ) : (
                <main className="ex-main">
                    <ol className="ex-rows">
                        {filtered.map((s) => {
                            const d = s.Driver;
                            const team = s.Constructors?.[0];
                            const accent = getTeamAccent(team?.constructorId);
                            return (
                                <li key={d.driverId}>
                                    <Link
                                        to={`/drivers/${year}/${d.driverId}`}
                                        viewTransition
                                        className="ex-row"
                                        style={{ "--accent": accent }}
                                    >
                                        <span className="ex-row-pos">
                                            {String(s.position).padStart(2, "0")}
                                        </span>
                                        <span
                                            className="ex-row-num"
                                            style={{ viewTransitionName: "driver-number" }}
                                        >
                                            {d.permanentNumber ?? "—"}
                                        </span>
                                        <span className="ex-row-name">
                                            {d.givenName} <b>{d.familyName}</b>
                                        </span>
                                        <span className="ex-row-nat">{d.nationality}</span>
                                        <span className="ex-row-team">
                                            <i className="ex-row-swatch" aria-hidden="true" />
                                            {team?.name ?? "—"}
                                        </span>
                                        <span className="ex-row-stat">
                                            <b>{s.points}</b><small>PTS</small>
                                        </span>
                                        <span className="ex-row-stat">
                                            <b>{s.wins}</b><small>WINS</small>
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

export default Drivers;
