import { useState, useEffect } from "react";
import { ArrowLeftRight } from "lucide-react";
import { SearchControls, DriverRoster, DriverCard } from "../components/EntityListing";
import { LoadingSpinner, Stat, Button, EmptyState } from "../components/UI";
import { CompareModal } from "../components/Compare";
import driverInfo from "../data/driverInfo";
import "../styles/pages/EntityPages.css";
import "../styles/pages/Comparison.css";
import { API_BASE_URL as API } from "../config/api";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

/* The six metrics the Compare Drivers modal shows — reuses this page's
   own already-fetched standings (position/points/wins-this-season) plus
   the shared driverInfo career data (championships/career wins/podiums/
   debut), never a second fetch or a duplicate lookup. */
function driverCompareMetrics(standing) {
    const info = driverInfo[`${standing.Driver.givenName} ${standing.Driver.familyName}`];
    return {
        position: standing.position,
        points: standing.points,
        wins: info?.raceWins,
        podiums: info?.podiums,
        championships: info?.championships,
        debut: info?.debut,
    };
}

/*
 * THE DRIVERS — a premium grid, not a database table. Dark hero → a light
 * Cararra overview band (grid size, at a glance) → the dark driver grid
 * itself. Every driver's racing number and championship position are
 * always visible; a real portrait cutout is used where one genuinely
 * exists (see config/driverAssets.js) and a bold ghost number stands in
 * where it doesn't — never a random low-quality photo. "Compare Drivers"
 * next to the search bar opens a compact head-to-head modal in place —
 * no separate comparison page.
 */
function Drivers() {
    const [drivers, setDrivers] = useState([]);
    const [loadedYear, setLoadedYear] = useState(null);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState("2026");
    const [compareOpen, setCompareOpen] = useState(false);
    const loaded = loadedYear === year;

    useEffect(() => {
        fetch(`${API}/drivers/standings/${year}`)
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
                    >
                        <Button variant="dark" size="sm" onClick={() => setCompareOpen(true)}>
                            <ArrowLeftRight size={14} aria-hidden="true" /> Compare Drivers
                        </Button>
                    </SearchControls>
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

            <CompareModal
                open={compareOpen}
                onClose={() => setCompareOpen(false)}
                title="Compare Drivers"
                entityLabel="Driver"
                searchPlaceholder="Search drivers…"
                options={drivers}
                getId={(s) => s.Driver.driverId}
                getLabel={(s) => `${s.Driver.givenName} ${s.Driver.familyName}`}
                getSubLabel={(s) => s.Constructors?.[0]?.name ?? s.Driver.nationality}
                getMetrics={driverCompareMetrics}
            />
        </div>
    );
}

export default Drivers;
