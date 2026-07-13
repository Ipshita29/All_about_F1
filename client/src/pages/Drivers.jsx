import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import GridCarousel from "../components/entity/GridCarousel";
import DriverPass from "../components/entity/DriverPass";
import LoadingSpinner from "../components/LoadingSpinner";
import "./EntityPages.css";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

/*
 * THE GRID — the drivers page as a starting-grid experience.
 * One centered coverflow of Driver Passes; selecting the focused pass
 * unfolds it into the Driver Details dossier via a shared element
 * transition. The last-viewed driver and season are remembered so
 * returning from a dossier restores the exact grid position.
 */
function Drivers() {
    const navigate = useNavigate();
    const [drivers, setDrivers] = useState([]);
    const [loadedYear, setLoadedYear] = useState(null);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState(
        () => sessionStorage.getItem("ex-grid-year") || "2026"
    );
    const [active, setActive] = useState(0);
    const loaded = loadedYear === year;

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/standings/${year}`)
            .then((res) => res.json())
            .then((data) => {
                const list = Array.isArray(data) ? data : [];
                setDrivers(list);
                /* restore the grid to the driver that was open before */
                const savedId = sessionStorage.getItem("ex-grid-driver");
                const idx = savedId
                    ? list.findIndex((d) => d.Driver.driverId === savedId)
                    : -1;
                setActive(idx >= 0 ? idx : 0);
                setLoadedYear(year);
            });
    }, [year]);

    const filtered = drivers.filter((d) =>
        `${d.Driver.givenName} ${d.Driver.familyName}`
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    const activeIdx = Math.min(active, Math.max(0, filtered.length - 1));
    const focused = filtered[activeIdx];

    const handleSearch = (value) => {
        setSearch(value);
        setActive(0);
    };

    const openDossier = (standing) => {
        sessionStorage.setItem("ex-grid-driver", standing.Driver.driverId);
        sessionStorage.setItem("ex-grid-year", year);
        navigate(`/drivers/${year}/${standing.Driver.driverId}`, {
            viewTransition: true,
        });
    };

    return (
        <div className="ex ex-grid-page">
            <header className="ex-hero">
                <span className="ex-hero-eyebrow">Formula 1 · {year} Season</span>
                <h1 className="ex-hero-title">The Grid</h1>
                <p className="ex-hero-sub">20 Drivers. 20 Stories. One Championship.</p>
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
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </label>
                    <span className="ex-count">{filtered.length} ON GRID</span>
                    <Link to="/compare-drivers" className="ex-cta">
                        Wheel to Wheel →
                    </Link>
                </div>
            </header>

            {!loaded ? (
                <div className="ex-loading"><LoadingSpinner /></div>
            ) : filtered.length === 0 ? (
                <div className="ex-main">
                    <div className="ex-empty">
                        <span className="ex-empty-title">No driver on this grid</span>
                        <span className="ex-empty-sub">ADJUST THE SEASON OR SEARCH</span>
                    </div>
                </div>
            ) : (
                <main className="ex-grid-stage">
                    <GridCarousel
                        items={filtered}
                        active={activeIdx}
                        onChange={setActive}
                        onSelect={openDossier}
                        getKey={(s) => s.Driver.driverId}
                        statusFor={(s) =>
                            `${s.Driver.givenName} ${s.Driver.familyName}, P${s.position}`
                        }
                        renderItem={(s, i, isCenter) => (
                            <DriverPass standing={s} isCenter={isCenter} />
                        )}
                    />
                    {focused && (
                        <p className="ex-hero-sub" style={{ textAlign: "center", marginTop: 18 }}>
                            SCROLL · DRAG · ARROW KEYS — SELECT THE PASS TO OPEN THE DOSSIER
                        </p>
                    )}
                </main>
            )}
        </div>
    );
}

export default Drivers;
