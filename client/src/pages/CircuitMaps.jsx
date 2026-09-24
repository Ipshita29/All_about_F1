import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { circuitInfo } from "../data/circuitInfo";
import CircuitVisualization from "../components/CircuitVisualization";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchControls from "../components/SearchControls";
import "../styles/pages/EntityPages.css";

function trackTypeLabel(trackType) {
    if (!trackType) return null;
    const t = trackType.toLowerCase();
    if (t.includes("hybrid")) return "Mixed";
    if (t.includes("temporary")) return "Temporary";
    if (t.includes("street")) return "Street";
    return "Permanent";
}

/*
 * THE CIRCUITS — every track as a technical drawing, not a photo card.
 * Each blueprint sits on its own white plate (see CircuitVisualization);
 * nothing is grayscale-inverted, so every circuit reads consistently
 * next to the others instead of some looking clean and others muddy.
 */
function CircuitMaps() {
    const [circuits, setCircuits] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetch("http://localhost:3000/circuitmaps")
            .then((res) => res.json())
            .then((data) => {
                setCircuits(Array.isArray(data) ? data : []);
                setLoaded(true);
            });
    }, []);

    const filtered = circuits.filter((c) =>
        c.circuitName.toLowerCase().includes(search.toLowerCase()) ||
        c.Location.country.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="ex">
            <header className="dr-hero">
                <span className="dr-hero-year">FORMULA 1</span>
                <h1 className="dr-hero-title">The Circuits</h1>
                <p className="dr-hero-sub">
                    {loaded ? circuits.length : "—"} tracks. Every layout, drawn to scale.
                </p>
            </header>

            <SearchControls
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="SEARCH CIRCUITS"
                count={`${filtered.length} CIRCUIT${filtered.length !== 1 ? "S" : ""}`}
            />

            {!loaded ? (
                <div className="ex-loading"><LoadingSpinner /></div>
            ) : filtered.length === 0 ? (
                <main className="ex-main">
                    <div className="ex-empty">
                        <span className="ex-empty-title">No circuit matches</span>
                        <span className="ex-empty-sub">ADJUST YOUR SEARCH</span>
                    </div>
                </main>
            ) : (
                <main className="ex-main">
                    <div className="cr-grid">
                        {filtered.map((c) => {
                            const info = circuitInfo[c.circuitId];
                            const type = trackTypeLabel(info?.trackType);
                            return (
                                <Link
                                    to={`/circuitmaps/${c.circuitId}`}
                                    key={c.circuitId}
                                    className="cr-item"
                                >
                                    <CircuitVisualization
                                        circuitId={c.circuitId}
                                        compact
                                        showMeta={false}
                                    />
                                    <div className="cr-body">
                                        <div className="cr-top">
                                            {type && <span className="circuit-badge">{type}</span>}
                                            {info?.firstGrandPrix && (
                                                <span className="circuit-since">SINCE {info.firstGrandPrix}</span>
                                            )}
                                        </div>
                                        <h3 className="cr-name">{c.circuitName}</h3>
                                        <span className="cr-loc">
                                            {c.Location.locality}, {c.Location.country}
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </main>
            )}
        </div>
    );
}

export default CircuitMaps;
