import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import teamInfo from "../data/teamInfo";
import ImagePlaceholder from "../components/ImagePlaceholder";

function Teams() {
    const [teams, setTeams] = useState([]);
    const [search, setSearch] = useState("");
    const [year, setYear] = useState("2026");

    useEffect(() => {
        fetch(`http://localhost:3000/teams/${year}`)
            .then((res) => res.json())
            .then((data) => setTeams(data));
    }, [year]);

    const filtered = teams.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="page">
            <h1>Teams</h1>
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
                    placeholder="Search team..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <p>{filtered.length} team{filtered.length !== 1 ? "s" : ""}</p>
                <Link to="/compare-teams">
                    <button>Compare Teams</button>
                </Link>
            </div>

            <div className="list-grid">
                {filtered.map((t) => {
                    const info = teamInfo[t.constructorId];
                    const teamColor = info?.teamColors?.primary;
                    return (
                        <Link
                            to={`/teams/${year}/${t.constructorId}`}
                            key={t.constructorId}
                            className="list-card team-list-card"
                            style={{ borderTopColor: teamColor || "#E10600" }}
                        >
                            <div className="team-list-img-wrap" style={{ "--team-color": teamColor || "#E10600" }}>
                                <ImagePlaceholder name={t.name} type="team" color={teamColor || "#E10600"} className="entity-placeholder" />
                                {info?.image && (
                                    <img
                                        src={info.image}
                                        alt={`${t.name} car`}
                                        className="team-list-img"
                                        onError={(e) => { e.target.style.display = "none"; }}
                                    />
                                )}
                                {info?.logo && (
                                    <img
                                        src={info.logo}
                                        alt={`${t.name} logo`}
                                        className="team-list-logo"
                                    />
                                )}
                            </div>
                            <div className="team-list-body">
                                <h3>{t.name}</h3>
                                <p>{t.nationality}</p>
                                {info?.engineSupplier && (
                                    <p>{info.engineSupplier} Power Unit</p>
                                )}
                                {info?.teamPrincipal && (
                                    <p className="list-date">TP: {info.teamPrincipal}</p>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

export default Teams;
