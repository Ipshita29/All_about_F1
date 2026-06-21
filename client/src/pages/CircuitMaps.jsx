import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { circuitInfo } from "../data/circuitInfo";

function getTrackBadge(trackType) {
    if (!trackType) return null;
    const t = trackType.toLowerCase();
    if (t.includes("hybrid"))    return { label: "Mixed",     bg: "#f3e8fd", color: "#7c3aed" };
    if (t.includes("temporary")) return { label: "Temporary", bg: "#fff3e0", color: "#bf6000" };
    if (t.includes("street"))    return { label: "Street",    bg: "#e8f4fd", color: "#0369a1" };
    return                              { label: "Permanent", bg: "#f0f0f4", color: "#4b5563" };
}

function CircuitMaps() {
    const [circuits, setCircuits] = useState([]);
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetch("http://localhost:3000/circuitmaps")
            .then((res) => res.json())
            .then((data) => setCircuits(data));
    }, []);

    const filtered = circuits.filter((c) =>
        c.circuitName.toLowerCase().includes(search.toLowerCase()) ||
        c.Location.country.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="page">
            <h1>Circuits</h1>
            <div className="page-controls">
                <input
                    type="text"
                    placeholder="Search by name or country..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <p>{filtered.length} circuit{filtered.length !== 1 ? "s" : ""}</p>
            </div>

            <div className="list-grid circuit-grid">
                {filtered.map((c) => {
                    const info = circuitInfo[c.circuitId];
                    const badge = getTrackBadge(info?.trackType);
                    return (
                        <Link
                            to={`/circuitmaps/${c.circuitId}`}
                            key={c.circuitId}
                            className="list-card circuit-card"
                        >
                            {info?.mapImage ? (
                                <div className="circuit-card-img">
                                    <img src={info.mapImage} alt={c.circuitName} />
                                </div>
                            ) : (
                                <div className="circuit-card-img circuit-card-placeholder">
                                    <span>{c.circuitName[0]}</span>
                                </div>
                            )}
                            <div className="circuit-card-body">
                                <h3>{c.circuitName}</h3>
                                <p>{c.Location.locality}, {c.Location.country}</p>
                                <div className="circuit-card-meta">
                                    {badge && (
                                        <span
                                            className="circuit-badge"
                                            style={{ background: badge.bg, color: badge.color }}
                                        >
                                            {badge.label}
                                        </span>
                                    )}
                                    {info?.firstGrandPrix && (
                                        <span className="circuit-since">Since {info.firstGrandPrix}</span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

export default CircuitMaps;
