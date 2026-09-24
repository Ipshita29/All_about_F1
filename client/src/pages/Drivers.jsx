import { useState, useEffect } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchControls from "../components/SearchControls";
import DriverRoster from "../components/DriverRoster";
import DriverCard from "../components/DriverCard";
import Stat from "../components/Stat";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import "../styles/pages/EntityPages.css";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

/*
 * THE DRIVERS — a premium grid, not a database table. Dark hero → a light
 * Cararra overview band (grid size, at a glance) → the dark driver grid
 * itself → a light "compare the grid" close. Every driver's racing
 * number and championship position are always visible; a real portrait
 * cutout is used where one genuinely exists (see config/driverAssets.js)
 * and a bold ghost number stands in where it doesn't — never a random
 * low-quality photo.
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

    const teamCount = new Set(
        drivers.map((d) => d.Constructors?.[0]?.constructorId).filter(Boolean)
    ).size;

    return (
        <div className="ex">
            <header className="dr-hero">
                <span className="dr-hero-year">FORMULA 1 · {year} GRID</span>
                <h1 className="dr-hero-title">The Drivers</h1>
                <p className="dr-hero-sub">Twenty drivers. One championship.</p>
            </header>

            <div className="gr-overview">
                <div className="gr-overview-inner">
                    <div className="stat-row">
                        <Stat onLight value={loaded ? drivers.length : "20"} label="Drivers" />
                        <Stat onLight value={loaded ? teamCount : "10"} label="Teams" />
                        <Stat onLight value={year} label="Season" />
                    </div>
                    <SearchControls
                        year={year}
                        years={YEARS}
                        onYearChange={setYear}
                        search={search}
                        onSearchChange={setSearch}
                        searchPlaceholder="SEARCH DRIVERS"
                        count={`${filtered.length} ON GRID`}
                        onLight
                    />
                </div>
            </div>

            {!loaded ? (
                <div className="ex-loading"><LoadingSpinner /></div>
            ) : filtered.length === 0 ? (
                <main className="ex-main">
                    <EmptyState
                        title="No driver on this grid"
                        description="Adjust the season or search to find who you're looking for."
                    />
                </main>
            ) : (
                <main className="ex-main">
                    <DriverRoster>
                        {filtered.map((s) => (
                            <DriverCard key={s.Driver.driverId} standing={s} year={year} />
                        ))}
                    </DriverRoster>
                </main>
            )}

            <section className="gr-cta">
                <div className="gr-cta-inner">
                    <div>
                        <span className="gr-cta-eyebrow">HEAD TO HEAD</span>
                        <h2 className="gr-cta-title">Compare The Grid</h2>
                        <p className="gr-cta-copy">Put any two drivers head-to-head, season by season.</p>
                    </div>
                    <Button variant="dark" to="/compare-drivers" arrow>Compare Drivers</Button>
                </div>
            </section>
        </div>
    );
}

export default Drivers;
