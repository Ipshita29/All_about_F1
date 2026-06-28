import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import driverInfo from "../data/driverInfo";
import ImagePlaceholder from "../components/ImagePlaceholder";

function Drivers() {
    const [drivers, setDrivers] = useState([]);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState("2026");

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setDrivers(data));
    }, [year]);

    const filtered = drivers.filter((d) =>
        `${d.Driver.givenName} ${d.Driver.familyName}`
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    return (
        <div className="page">
            <h1>Drivers</h1>
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
                    placeholder="Search by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <p>{filtered.length} drivers</p>
                <Link to="/compare-drivers">
                    <button>Compare Drivers</button>
                </Link>
            </div>

            <div className="list-grid">
                {filtered.map((d) => (
                    <Link
                        to={`/drivers/${year}/${d.Driver.driverId}`}
                        key={d.Driver.driverId}
                        className="list-card driver-list-card"
                    >
                        {(() => {
                            const info = driverInfo[`${d.Driver.givenName} ${d.Driver.familyName}`];
                            const name = `${d.Driver.givenName} ${d.Driver.familyName}`;
                            return (
                                <div className="driver-list-img-wrap">
                                    <ImagePlaceholder name={name} type="driver" className="entity-placeholder" />
                                    {info?.image && (
                                        <img
                                            src={info.image}
                                            alt={name}
                                            className="driver-list-img"
                                            onError={(e) => { e.target.style.display = "none"; }}
                                        />
                                    )}
                                </div>
                            );
                        })()}
                        <div className="driver-list-header">
                            <span
                                className="driver-list-pos"
                                style={{ color: Number(d.position) <= 3 ? "#E10600" : "#ccc" }}
                            >
                                P{d.position}
                            </span>
                            <h3>{d.Driver.givenName} {d.Driver.familyName}</h3>
                        </div>
                        <p>{d.Constructors[0].name}</p>
                        <p>{d.Driver.nationality}</p>
                        <p className="list-date">{d.points} pts · {d.wins} win{d.wins !== "1" ? "s" : ""}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default Drivers;
