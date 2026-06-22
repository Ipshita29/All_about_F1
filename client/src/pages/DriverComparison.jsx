import { useState, useEffect } from "react";
import driverInfo from "../data/driverInfo";
import KnowMoreModal from "../components/KnowMoreModal";
import { knowMoreInfo } from "../data/knowMoreInfo";
import KnowMoreTerm from "../components/KnowMoreTerm";

function getWinner(val1, val2, lowerIsBetter = false) {
    const n1 = parseFloat(val1);
    const n2 = parseFloat(val2);
    if (isNaN(n1) || isNaN(n2) || n1 === n2) return null;
    if (lowerIsBetter) return n1 < n2 ? "left" : "right";
    return n1 > n2 ? "left" : "right";
}

function CompareBar({ val1, val2, lowerIsBetter = false }) {
    const n1 = parseFloat(val1);
    const n2 = parseFloat(val2);
    if (isNaN(n1) || isNaN(n2) || n1 + n2 === 0) return null;
    const pct1 = lowerIsBetter ? (n2 / (n1 + n2)) * 100 : (n1 / (n1 + n2)) * 100;
    return (
        <div className="cmp-bar-track" style={{ gridColumn: "1 / -1" }}>
            <div className="cmp-bar-left" style={{ width: `${pct1}%` }} />
            <div className="cmp-bar-right" style={{ width: `${100 - pct1}%` }} />
        </div>
    );
}

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

function DriverComparison() {
    const [drivers, setDrivers] = useState([]);
    const [driver1, setDriver1] = useState("");
    const [driver2, setDriver2] = useState("");
    const [year, setYear] = useState("2026");
    const [standings, setStandings] = useState([]);
    const [selectedTerm, setSelectedTerm] = useState(null);

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
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={driver1} onChange={(e) => setDriver1(e.target.value)}>
                    <option value="">Driver 1</option>
                    {drivers.map((d) => (
                        <option key={d.driverId} value={d.driverId}>{d.givenName} {d.familyName}</option>
                    ))}
                </select>
                <select value={driver2} onChange={(e) => setDriver2(e.target.value)}>
                    <option value="">Driver 2</option>
                    {drivers.map((d) => (
                        <option key={d.driverId} value={d.driverId}>{d.givenName} {d.familyName}</option>
                    ))}
                </select>
            </div>

            {!d1 || !d2 ? (
                <div className="cmp-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                    </svg>
                    <span className="cmp-empty-title">Head-to-Head Comparison</span>
                    <span className="cmp-empty-sub">Select two drivers above to begin the comparison</span>
                </div>
            ) : (
                <>
                    {/* ── Dark Hero Header ── */}
                    <div className="cmp-hero">
                        <div className="cmp-hero-driver cmp-hero-left">
                            <div className="cmp-hero-number">#{d1.permanentNumber}</div>
                            <div className="cmp-hero-name-block">
                                <span className="cmp-hero-given">{d1.givenName}</span>
                                <span className="cmp-hero-family">{d1.familyName}</span>
                                {info1?.nickname && (
                                    <span className="cmp-hero-nick">"{info1.nickname}"</span>
                                )}
                            </div>
                            <div className="cmp-hero-tags">
                                {s1?.Constructors?.[0]?.name && (
                                    <span className="cmp-hero-tag">{s1.Constructors[0].name}</span>
                                )}
                                <span className="cmp-hero-tag">{d1.nationality}</span>
                            </div>
                        </div>

                        <div className="cmp-hero-vs">
                            <span className="cmp-hero-vs-text">VS</span>
                            <span className="cmp-hero-season-badge">{year} Season</span>
                        </div>

                        <div className="cmp-hero-driver cmp-hero-right">
                            <div className="cmp-hero-number">#{d2.permanentNumber}</div>
                            <div className="cmp-hero-name-block">
                                <span className="cmp-hero-given">{d2.givenName}</span>
                                <span className="cmp-hero-family">{d2.familyName}</span>
                                {info2?.nickname && (
                                    <span className="cmp-hero-nick">"{info2.nickname}"</span>
                                )}
                            </div>
                            <div className="cmp-hero-tags">
                                {s2?.Constructors?.[0]?.name && (
                                    <span className="cmp-hero-tag">{s2.Constructors[0].name}</span>
                                )}
                                <span className="cmp-hero-tag">{d2.nationality}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Season Stats ── */}
                    <div className="compare-block">
                        <div className="compare-block-title">{year} Season</div>

                        <div className="compare-row">
                            <div className={cls("left", s1?.position, s2?.position, true)}>{s1?.position ?? "—"}</div>
                            <div className="compare-label">
                                <KnowMoreTerm term="championship_leader" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Championship Pos.</KnowMoreTerm>
                            </div>
                            <div className={cls("right", s1?.position, s2?.position, true)}>{s2?.position ?? "—"}</div>
                            <CompareBar val1={s1?.position} val2={s2?.position} lowerIsBetter />
                        </div>

                        <div className="compare-row">
                            <div className={cls("left", s1?.points, s2?.points)}>{s1?.points ?? "—"}</div>
                            <div className="compare-label">
                                <KnowMoreTerm term="points_system" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Points</KnowMoreTerm>
                            </div>
                            <div className={cls("right", s1?.points, s2?.points)}>{s2?.points ?? "—"}</div>
                            <CompareBar val1={s1?.points} val2={s2?.points} />
                        </div>

                        <div className="compare-row">
                            <div className={cls("left", s1?.wins, s2?.wins)}>{s1?.wins ?? "—"}</div>
                            <div className="compare-label">Race Wins</div>
                            <div className={cls("right", s1?.wins, s2?.wins)}>{s2?.wins ?? "—"}</div>
                            <CompareBar val1={s1?.wins} val2={s2?.wins} />
                        </div>

                        <div className="compare-row">
                            <div className="compare-val" style={{ fontSize: "0.95rem" }}>{s1?.Constructors?.[0]?.name ?? "—"}</div>
                            <div className="compare-label">Team</div>
                            <div className="compare-val v-right" style={{ fontSize: "0.95rem" }}>{s2?.Constructors?.[0]?.name ?? "—"}</div>
                        </div>
                    </div>

                    {/* ── Career Stats ── */}
                    <div className="compare-block">
                        <div className="compare-block-title">Career Stats</div>

                        <div className="compare-row">
                            <div className={cls("left", info1?.championships, info2?.championships)}>{info1?.championships ?? "—"}</div>
                            <div className="compare-label">
                                <KnowMoreTerm term="drivers_championship" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Championships</KnowMoreTerm>
                            </div>
                            <div className={cls("right", info1?.championships, info2?.championships)}>{info2?.championships ?? "—"}</div>
                            <CompareBar val1={info1?.championships} val2={info2?.championships} />
                        </div>

                        <div className="compare-row">
                            <div className={cls("left", info1?.raceWins, info2?.raceWins)}>{info1?.raceWins ?? "—"}</div>
                            <div className="compare-label">Race Wins</div>
                            <div className={cls("right", info1?.raceWins, info2?.raceWins)}>{info2?.raceWins ?? "—"}</div>
                            <CompareBar val1={info1?.raceWins} val2={info2?.raceWins} />
                        </div>

                        <div className="compare-row">
                            <div className={cls("left", info1?.podiums, info2?.podiums)}>{info1?.podiums ?? "—"}</div>
                            <div className="compare-label">
                                <KnowMoreTerm term="podium" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Podiums</KnowMoreTerm>
                            </div>
                            <div className={cls("right", info1?.podiums, info2?.podiums)}>{info2?.podiums ?? "—"}</div>
                            <CompareBar val1={info1?.podiums} val2={info2?.podiums} />
                        </div>

                        <div className="compare-row">
                            <div className={cls("left", info1?.polePositions, info2?.polePositions)}>{info1?.polePositions ?? "—"}</div>
                            <div className="compare-label">
                                <KnowMoreTerm term="pole_position" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Pole Positions</KnowMoreTerm>
                            </div>
                            <div className={cls("right", info1?.polePositions, info2?.polePositions)}>{info2?.polePositions ?? "—"}</div>
                            <CompareBar val1={info1?.polePositions} val2={info2?.polePositions} />
                        </div>
                    </div>

                    {/* ── Driver Profile ── */}
                    <div className="compare-block">
                        <div className="compare-block-title">Driver Profile</div>

                        <div className="compare-row">
                            <div className="compare-val">{d1.nationality}</div>
                            <div className="compare-label">Nationality</div>
                            <div className="compare-val v-right">{d2.nationality}</div>
                        </div>

                        <div className="compare-row">
                            <div className="compare-val" style={{ fontSize: "0.95rem" }}>{d1.dateOfBirth}</div>
                            <div className="compare-label">Date of Birth</div>
                            <div className="compare-val v-right" style={{ fontSize: "0.95rem" }}>{d2.dateOfBirth}</div>
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

                    {/* ── About ── */}
                    {(info1 || info2) && (
                        <div className="compare-block">
                            <div className="compare-block-title">About</div>
                            <div className="compare-about">
                                <div className="compare-about-col">
                                    {info1?.quote && (
                                        <blockquote className="compare-quote">"{info1.quote}"</blockquote>
                                    )}
                                    <p>{info1?.description ?? "—"}</p>
                                </div>
                                <div className="compare-about-divider" />
                                <div className="compare-about-col">
                                    {info2?.quote && (
                                        <blockquote className="compare-quote">"{info2.quote}"</blockquote>
                                    )}
                                    <p>{info2?.description ?? "—"}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            <KnowMoreModal info={selectedTerm} onClose={() => setSelectedTerm(null)} />
        </div>
    );
}

export default DriverComparison;
