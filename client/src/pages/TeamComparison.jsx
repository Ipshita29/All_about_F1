import { useState, useEffect } from "react";
import teamInfo from "../data/teamInfo";

function getWinner(val1, val2, lowerIsBetter = false) {
    const n1 = parseFloat(val1);
    const n2 = parseFloat(val2);
    if (isNaN(n1) || isNaN(n2) || n1 === n2) return null;
    if (lowerIsBetter) return n1 < n2 ? "left" : "right";
    return n1 > n2 ? "left" : "right";
}

function DuelBar({ val1, val2, label, lowerIsBetter = false, color1, color2 }) {
    const n1 = parseFloat(val1);
    const n2 = parseFloat(val2);
    const valid = !isNaN(n1) && !isNaN(n2) && n1 + n2 > 0;
    let pct1 = 50;
    if (valid) {
        pct1 = lowerIsBetter ? (n2 / (n1 + n2)) * 100 : (n1 / (n1 + n2)) * 100;
    }
    const pct2 = 100 - pct1;
    const winner = getWinner(val1, val2, lowerIsBetter);

    return (
        <div className="duel-bar-row">
            <div className="duel-bar-vals">
                <span className={`duel-val${winner === "left" ? " duel-winner" : winner === "right" ? " duel-loser" : ""}`}>
                    {val1 ?? "—"}
                </span>
                <span className="duel-bar-label">{label}</span>
                <span className={`duel-val duel-val-right${winner === "right" ? " duel-winner" : winner === "left" ? " duel-loser" : ""}`}>
                    {val2 ?? "—"}
                </span>
            </div>
            <div className="duel-bar-track">
                <div className="duel-bar-fill-left" style={{ width: `${pct1}%`, background: color1 }} />
                <div className="duel-bar-fill-right" style={{ width: `${pct2}%`, background: color2 }} />
            </div>
        </div>
    );
}

function TeamComparison() {
    const [teams, setTeams] = useState([]);
    const [team1Id, setTeam1Id] = useState("");
    const [team2Id, setTeam2Id] = useState("");
    const [year, setYear] = useState("2026");
    const [standings, setStandings] = useState([]);

    const t1 = teams.find((t) => t.constructorId === team1Id);
    const t2 = teams.find((t) => t.constructorId === team2Id);
    const info1 = t1 ? teamInfo[t1.constructorId] : null;
    const info2 = t2 ? teamInfo[t2.constructorId] : null;
    const s1 = standings.find((s) => s.Constructor.constructorId === team1Id);
    const s2 = standings.find((s) => s.Constructor.constructorId === team2Id);

    useEffect(() => {
        fetch(`http://localhost:3000/teams/${year}`)
            .then((res) => res.json())
            .then((data) => setTeams(data));
    }, [year]);

    useEffect(() => {
        fetch(`http://localhost:3000/teams/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setStandings(data));
    }, [year]);

    const color1 = info1?.teamColors?.primary || "#E10600";
    const color2 = info2?.teamColors?.primary || "#15151E";

    return (
        <div className="page">
            <h1>Team Comparison</h1>

            <div className="page-controls">
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                    {["2020", "2021", "2022", "2023", "2024", "2025", "2026"].map((y) => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
                <select value={team1Id} onChange={(e) => setTeam1Id(e.target.value)}>
                    <option value="">Select Team 1</option>
                    {teams.map((t) => (
                        <option key={t.constructorId} value={t.constructorId}>{t.name}</option>
                    ))}
                </select>
                <select value={team2Id} onChange={(e) => setTeam2Id(e.target.value)}>
                    <option value="">Select Team 2</option>
                    {teams.map((t) => (
                        <option key={t.constructorId} value={t.constructorId}>{t.name}</option>
                    ))}
                </select>
            </div>

            {!t1 || !t2 ? (
                <p style={{ color: "#999", marginTop: 20 }}>Select two teams above to compare.</p>
            ) : (
                <div style={{ padding: 0 }}>

                    {/* Team Header Panels */}
                    <div className="team-compare-panels">
                        <div className="team-compare-panel" style={{ borderTop: `5px solid ${color1}` }}>
                            {info1?.logo && (
                                <img src={info1.logo} alt={`${t1.name} logo`} style={{ height: 52, objectFit: "contain", marginBottom: 8 }} />
                            )}
                            <h2 style={{ color: color1 }}>{t1.name}</h2>
                            <p>{t1.nationality}</p>
                            {info1?.founded && <p>Est. {info1.founded}</p>}
                            {info1?.teamPrincipal && <p className="tcp-tp">TP: {info1.teamPrincipal}</p>}
                            {info1?.championships != null && (
                                <div className="tcp-championships" style={{ color: color1 }}>{info1.championships}</div>
                            )}
                            {info1?.championships != null && <p className="tcp-champs-label">championships</p>}
                        </div>

                        <div className="team-compare-vs-col">
                            <div className="team-compare-vs">VS</div>
                        </div>

                        <div className="team-compare-panel" style={{ borderTop: `5px solid ${color2}` }}>
                            {info2?.logo && (
                                <img src={info2.logo} alt={`${t2.name} logo`} style={{ height: 52, objectFit: "contain", marginBottom: 8 }} />
                            )}
                            <h2 style={{ color: color2 }}>{t2.name}</h2>
                            <p>{t2.nationality}</p>
                            {info2?.founded && <p>Est. {info2.founded}</p>}
                            {info2?.teamPrincipal && <p className="tcp-tp">TP: {info2.teamPrincipal}</p>}
                            {info2?.championships != null && (
                                <div className="tcp-championships" style={{ color: color2 }}>{info2.championships}</div>
                            )}
                            {info2?.championships != null && <p className="tcp-champs-label">championships</p>}
                        </div>
                    </div>

                    {/* Season Stats */}
                    <div className="duel-block">
                        <div className="duel-block-title">{year} Season</div>
                        <DuelBar val1={s1?.position} val2={s2?.position} label="Championship Position" lowerIsBetter color1={color1} color2={color2} />
                        <DuelBar val1={s1?.points} val2={s2?.points} label="Points" color1={color1} color2={color2} />
                        <DuelBar val1={s1?.wins} val2={s2?.wins} label="Race Wins" color1={color1} color2={color2} />
                    </div>

                    {/* All-Time */}
                    <div className="duel-block">
                        <div className="duel-block-title">All-Time</div>
                        <DuelBar val1={info1?.championships} val2={info2?.championships} label="Championships" color1={color1} color2={color2} />
                    </div>

                    {/* Team Profile */}
                    <div className="duel-block">
                        <div className="duel-block-title">Team Profile</div>
                        <div className="duel-info-grid">
                            <div className="duel-info-col" style={{ borderTop: `3px solid ${color1}` }}>
                                {info1?.engineSupplier && (
                                    <div className="duel-info-row">
                                        <span className="duel-info-label">Engine</span>
                                        <span>{info1.engineSupplier}</span>
                                    </div>
                                )}
                                {info1?.headquarters && (
                                    <div className="duel-info-row">
                                        <span className="duel-info-label">Headquarters</span>
                                        <span>{info1.headquarters}</span>
                                    </div>
                                )}
                            </div>
                            <div className="duel-info-col" style={{ borderTop: `3px solid ${color2}` }}>
                                {info2?.engineSupplier && (
                                    <div className="duel-info-row">
                                        <span className="duel-info-label">Engine</span>
                                        <span>{info2.engineSupplier}</span>
                                    </div>
                                )}
                                {info2?.headquarters && (
                                    <div className="duel-info-row">
                                        <span className="duel-info-label">Headquarters</span>
                                        <span>{info2.headquarters}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Strategy */}
                    {(info1?.strategyStyle || info2?.strategyStyle) && (
                        <div className="duel-block">
                            <div className="duel-block-title">Strategy Style</div>
                            <div className="duel-info-grid">
                                <div className="duel-info-col" style={{ borderTop: `3px solid ${color1}` }}>
                                    <p style={{ fontSize: "0.875rem", color: "#444", lineHeight: 1.65, padding: 0, margin: 0 }}>
                                        {info1?.strategyStyle ?? "—"}
                                    </p>
                                </div>
                                <div className="duel-info-col" style={{ borderTop: `3px solid ${color2}` }}>
                                    <p style={{ fontSize: "0.875rem", color: "#444", lineHeight: 1.65, padding: 0, margin: 0 }}>
                                        {info2?.strategyStyle ?? "—"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}

export default TeamComparison;
