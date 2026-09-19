import { useState, useEffect } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchControls from "../components/entity/SearchControls";
import ComparisonCTA from "../components/entity/ComparisonCTA";
import DriverRoster from "../components/entity/DriverRoster";
import DriverProfileRow from "../components/entity/DriverProfileRow";
import { getTeamAccent } from "../config/driverAssets";
import "./EntityPages.css";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

/*
 * THE DRIVERS — a championship roster, not a database table. The racing
 * number is each driver's visual identity; team colour is reduced to a
 * hairline accent. Selecting an item opens the Driver Dossier via a
 * shared-element view transition on the racing number.
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
            <header className="dr-hero">
                <span className="dr-hero-year">{year} SEASON</span>
                <h1 className="dr-hero-title">The Drivers</h1>
                <p className="dr-hero-sub">
                    {loaded ? drivers.length : "20"} competitors. One championship.
                </p>
            </header>

            <SearchControls
                year={year}
                years={YEARS}
                onYearChange={setYear}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="SEARCH DRIVERS"
                count={`${filtered.length} ON GRID`}
            >
                <ComparisonCTA to="/compare-drivers" label="Compare Drivers" />
            </SearchControls>

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
                    <DriverRoster>
                        {filtered.map((s) => (
                            <DriverProfileRow
                                key={s.Driver.driverId}
                                standing={s}
                                year={year}
                                accent={getTeamAccent(s.Constructors?.[0]?.constructorId)}
                            />
                        ))}
                    </DriverRoster>
                </main>
            )}
        </div>
    );
}

export default Drivers;
