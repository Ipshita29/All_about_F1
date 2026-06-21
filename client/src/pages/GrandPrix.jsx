import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

function formatRaceDate(dateStr) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function GrandPrix() {
    const [grandprix, setGrandprix] = useState([]);
    const [year, setYear] = useState("2026");
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetch(`http://localhost:3000/grandprixdashboard/${year}`)
            .then((res) => res.json())
            .then((data) => setGrandprix(data));
    }, [year]);

    const now = new Date();

    const filtered = grandprix.filter((ele) =>
        `${ele.raceName} ${ele.Circuit.Location.country}`
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    return (
        <div className="page">
            <h1>Grand Prix Schedule</h1>
            <div className="page-controls">
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                    <option value="2020">2020</option>
                    <option value="2021">2021</option>
                    <option value="2022">2022</option>
                    <option value="2023">2023</option>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                </select>
                <input
                    type="text"
                    placeholder="Search race or country..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <p>{filtered.length} race{filtered.length !== 1 ? "s" : ""}</p>
            </div>

            <div className="list-grid">
                {filtered.map((ele) => {
                    const isPast = new Date(ele.date + "T00:00:00") < now;
                    const hasSprint = !!ele.Sprint;
                    return (
                        <Link
                            to={`/grandprixdashboard/${year}/${ele.round}`}
                            key={ele.round}
                            className="list-card"
                            style={{ opacity: isPast ? 0.72 : 1 }}
                        >
                            <div className="gp-card-header">
                                <span className="gp-round">Round {ele.round}</span>
                                <div className="gp-badges">
                                    {hasSprint && <span className="gp-badge gp-badge-sprint">Sprint</span>}
                                    {isPast
                                        ? <span className="gp-badge gp-badge-done">Done</span>
                                        : <span className="gp-badge gp-badge-upcoming">Upcoming</span>
                                    }
                                </div>
                            </div>
                            <h3>{ele.raceName}</h3>
                            <p>{ele.Circuit.circuitName}</p>
                            <p className="list-date">
                                {formatRaceDate(ele.date)} · {ele.Circuit.Location.country}
                            </p>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

export default GrandPrix;
