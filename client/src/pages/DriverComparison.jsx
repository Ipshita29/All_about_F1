import { useState, useEffect } from "react";
import driverInfo from "../data/driverInfo";

function getWinner(val1, val2, lowerIsBetter = false) {
    const n1 = parseFloat(val1);
    const n2 = parseFloat(val2);
    if (isNaN(n1) || isNaN(n2) || n1 === n2) return null;
    if (lowerIsBetter) return n1 < n2 ? "left" : "right";
    return n1 > n2 ? "left" : "right";
}

function DriverComparison() {
    const [drivers, setDrivers] = useState([]);
    const [driver1, setDriver1] = useState("");
    const [driver2, setDriver2] = useState("");
    const [year, setYear] = useState("2026");
    const [standings, setStandings] = useState([]);

    const d1 = drivers.find((d) => d.driverId === driver1);
    const d2 = drivers.find((d) => d.driverId === driver2);
    const info1 = d1 ? driverInfo[`${d1.givenName} ${d1.familyName}`] : null;
    const info2 = d2 ? driverInfo[`${d2.givenName} ${d2.familyName}`] : null;
    const s1 = standings.find((s) => s.Driver.driverId === driver1);
    const s2 = standings.find((s) => s.Driver.driverId === driver2);

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/${year}`)
            .then((res) => res.json())
            .then((data) => setDrivers(data));
    }, [year]);

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setStandings(data));
    }, [year]);

    function cls(side, val1, val2, lowerIsBetter = false) {
        const right = side === "right" ? " v-right" : "";
        const w = getWinner(val1, val2, lowerIsBetter);
        if (w === null) return "compare-val" + right;
        return w === side ? "compare-val winning" + right : "compare-val losing" + right;
    }

    return (
        <div className="page">
            <h1>Driver Comparison</h1>

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

                <select value={driver1} onChange={(e) => setDriver1(e.target.value)}>
                    <option value="">Select Driver 1</option>
                    {drivers.map((d) => (
                        <option key={d.driverId} value={d.driverId}>
                            {d.givenName} {d.familyName}
                        </option>
                    ))}
                </select>

                <select value={driver2} onChange={(e) => setDriver2(e.target.value)}>
                    <option value="">Select Driver 2</option>
                    {drivers.map((d) => (
                        <option key={d.driverId} value={d.driverId}>
                            {d.givenName} {d.familyName}
                        </option>
                    ))}
                </select>
            </div>

            {!d1 || !d2 ? (
                <p style={{ color: "#999", marginTop: 20 }}>Select two drivers above to compare.</p>
            ) : (
                <div style={{ padding: 0 }}>

                    {/* VS Header */}
                    <div className="compare-header">
                        <div className="compare-driver compare-driver-left">
                            <div className="compare-big-number">#{d1.permanentNumber}</div>
                            <h2>{d1.givenName}<br />{d1.familyName}</h2>
                            {info1?.nickname && <p className="compare-nickname">"{info1.nickname}"</p>}
                            <p>{s1?.Constructors?.[0]?.name ?? "—"}</p>
                            <p>{d1.nationality}</p>
                        </div>

                        <div className="compare-vs-badge">VS</div>

                        <div className="compare-driver compare-driver-right">
                            <div className="compare-big-number">#{d2.permanentNumber}</div>
                            <h2>{d2.givenName}<br />{d2.familyName}</h2>
                            {info2?.nickname && <p className="compare-nickname">"{info2.nickname}"</p>}
                            <p>{s2?.Constructors?.[0]?.name ?? "—"}</p>
                            <p>{d2.nationality}</p>
                        </div>
                    </div>

                    {/* Season Stats */}
                    <div className="compare-block">
                        <div className="compare-block-title">{year} Season</div>

                        <div className="compare-row">
                            <div className={cls("left", s1?.position, s2?.position, true)}>{s1?.position ?? "—"}</div>
                            <div className="compare-label">Championship Position</div>
                            <div className={cls("right", s1?.position, s2?.position, true)}>{s2?.position ?? "—"}</div>
                        </div>

                        <div className="compare-row">
                            <div className={cls("left", s1?.points, s2?.points)}>{s1?.points ?? "—"}</div>
                            <div className="compare-label">Points</div>
                            <div className={cls("right", s1?.points, s2?.points)}>{s2?.points ?? "—"}</div>
                        </div>

                        <div className="compare-row">
                            <div className={cls("left", s1?.wins, s2?.wins)}>{s1?.wins ?? "—"}</div>
                            <div className="compare-label">Race Wins</div>
                            <div className={cls("right", s1?.wins, s2?.wins)}>{s2?.wins ?? "—"}</div>
                        </div>

                        <div className="compare-row">
                            <div className="compare-val">{s1?.Constructors?.[0]?.name ?? "—"}</div>
                            <div className="compare-label">Team</div>
                            <div className="compare-val v-right">{s2?.Constructors?.[0]?.name ?? "—"}</div>
                        </div>
                    </div>

                    {/* Career Stats */}
                    <div className="compare-block">
                        <div className="compare-block-title">Career Stats</div>

                        <div className="compare-row">
                            <div className={cls("left", info1?.championships, info2?.championships)}>{info1?.championships ?? "—"}</div>
                            <div className="compare-label">Championships</div>
                            <div className={cls("right", info1?.championships, info2?.championships)}>{info2?.championships ?? "—"}</div>
                        </div>

                        <div className="compare-row">
                            <div className={cls("left", info1?.raceWins, info2?.raceWins)}>{info1?.raceWins ?? "—"}</div>
                            <div className="compare-label">Race Wins</div>
                            <div className={cls("right", info1?.raceWins, info2?.raceWins)}>{info2?.raceWins ?? "—"}</div>
                        </div>

                        <div className="compare-row">
                            <div className={cls("left", info1?.podiums, info2?.podiums)}>{info1?.podiums ?? "—"}</div>
                            <div className="compare-label">Podiums</div>
                            <div className={cls("right", info1?.podiums, info2?.podiums)}>{info2?.podiums ?? "—"}</div>
                        </div>

                        <div className="compare-row">
                            <div className={cls("left", info1?.polePositions, info2?.polePositions)}>{info1?.polePositions ?? "—"}</div>
                            <div className="compare-label">Pole Positions</div>
                            <div className={cls("right", info1?.polePositions, info2?.polePositions)}>{info2?.polePositions ?? "—"}</div>
                        </div>
                    </div>

                    {/* Driver Profile */}
                    <div className="compare-block">
                        <div className="compare-block-title">Driver Profile</div>

                        <div className="compare-row">
                            <div className="compare-val">{d1.nationality}</div>
                            <div className="compare-label">Nationality</div>
                            <div className="compare-val v-right">{d2.nationality}</div>
                        </div>

                        <div className="compare-row">
                            <div className="compare-val">{d1.dateOfBirth}</div>
                            <div className="compare-label">Date of Birth</div>
                            <div className="compare-val v-right">{d2.dateOfBirth}</div>
                        </div>

                        <div className="compare-row">
                            <div className="compare-val">{d1.code}</div>
                            <div className="compare-label">Driver Code</div>
                            <div className="compare-val v-right">{d2.code}</div>
                        </div>

                        <div className="compare-row">
                            <div className="compare-val" style={{ fontSize: "0.95rem" }}>{info1?.debut ?? "—"}</div>
                            <div className="compare-label">F1 Debut</div>
                            <div className="compare-val v-right" style={{ fontSize: "0.95rem" }}>{info2?.debut ?? "—"}</div>
                        </div>

                        <div className="compare-row">
                            <div className="compare-val" style={{ fontSize: "0.95rem" }}>{info1?.bestSeason ?? "—"}</div>
                            <div className="compare-label">Best Season</div>
                            <div className="compare-val v-right" style={{ fontSize: "0.95rem" }}>{info2?.bestSeason ?? "—"}</div>
                        </div>
                    </div>

                    {/* About */}
                    {(info1 || info2) && (
                        <div className="compare-block">
                            <div className="compare-block-title">About</div>
                            <div className="compare-about">
                                <div>
                                    {info1?.quote && <p className="compare-quote">"{info1.quote}"</p>}
                                    <p>{info1?.description ?? "—"}</p>
                                </div>
                                <div>
                                    {info2?.quote && <p className="compare-quote">"{info2.quote}"</p>}
                                    <p>{info2?.description ?? "—"}</p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}

export default DriverComparison;
