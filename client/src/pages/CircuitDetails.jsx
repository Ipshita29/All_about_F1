import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { circuitInfo } from "../data/circuitInfo";
import LoadingSpinner from "../components/LoadingSpinner";
import KnowMoreModal from "../components/KnowMoreModal";
import { knowMoreInfo } from "../data/knowMoreInfo";
import KnowMoreTerm from "../components/KnowMoreTerm";
import CircuitVisualization from "../components/CircuitVisualization";
import ExSection from "../components/ExSection";
import TelemetryStat from "../components/TelemetryStat";
import "../styles/pages/EntityPages.css";

const API = "http://localhost:3000";

/*
 * CIRCUIT DOSSIER — a technical file, not a generic content page. The
 * blueprint (CircuitVisualization) carries the same white-plate treatment
 * used on the Circuits roster and the homepage, so a driver arriving here
 * from any of those places sees one consistent circuit language.
 */
function CircuitDetails() {
    const { id } = useParams();
    const [circuit, setCircuit] = useState(null);
    const [selectedTerm, setSelectedTerm] = useState(null);

    useEffect(() => {
        fetch(`${API}/circuitmaps`)
            .then((res) => res.json())
            .then((data) => {
                const selected = data.find((ele) => ele.circuitId === id);
                setCircuit(selected);
            });
    }, [id]);

    if (!circuit) return <div className="ex"><div className="ex-loading"><LoadingSpinner /></div></div>;

    const info = circuitInfo[id];

    return (
        <div className="ex">
            <header className="ex-tg-hero">
                <Link to="/circuitmaps" className="ex-back">← BACK TO CIRCUITS</Link>

                <p className="ex-tg-kicker" style={{ display: "block", marginTop: 26 }}>
                    CIRCUIT DOSSIER{info?.trackType ? ` · ${info.trackType.toUpperCase()}` : ""}
                </p>

                <h1 className="ex-tg-name">{circuit.circuitName}</h1>

                <div className="ex-dossier-tags" style={{ justifyContent: "center" }}>
                    <span className="ex-tag ex-tag--accent">
                        {circuit.Location.locality}, {circuit.Location.country}
                    </span>
                    <span className="ex-tag">
                        <a href={circuit.url} target="_blank" rel="noreferrer">WIKIPEDIA ↗</a>
                    </span>
                </div>

                <div style={{ maxWidth: 420, margin: "0 auto" }}>
                    <CircuitVisualization
                        circuitId={id}
                        circuitName={circuit.circuitName}
                        info={info}
                    />
                </div>
            </header>

            <main className="ex-main">
                <ExSection eyebrow="Engineering" title="Track Information">
                    <div className="ex-stat-row">
                        <TelemetryStat value={info?.laps ?? "—"} label="Laps" accent />
                        <TelemetryStat value={info?.turns ?? "—"} label="Turns" />
                        <TelemetryStat
                            value={info?.drsZones ?? "—"}
                            label={
                                <KnowMoreTerm term="drs" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>
                                    DRS Zones
                                </KnowMoreTerm>
                            }
                        />
                    </div>
                    <p className="ex-prose" style={{ marginTop: 22 }}>
                        Track length {info?.length ?? "—"} · Race distance {info?.raceDistance ?? "—"}
                    </p>
                </ExSection>

                {info?.lapRecord && (
                    <ExSection eyebrow="Fastest Ever" title="Lap Record">
                        <div className="ex-stat-row">
                            <TelemetryStat
                                value={info.lapRecord}
                                label={
                                    <KnowMoreTerm term="fastest_lap" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>
                                        Lap Record
                                    </KnowMoreTerm>
                                }
                                accent
                            />
                            <TelemetryStat value={info.lapRecordHolder} label="Record Holder" />
                            <TelemetryStat value={info.lapRecordYear} label="Year Set" />
                        </div>
                    </ExSection>
                )}

                <ExSection eyebrow="Character" title="Circuit Profile">
                    <div className="ex-stat-row">
                        <TelemetryStat value={info?.difficulty ?? "—"} label="Difficulty" />
                        <TelemetryStat
                            value={info?.difficultyRating ?? "—"}
                            label="Rating"
                            sub={info?.difficultyRating ? "OUT OF 5" : undefined}
                        />
                        <TelemetryStat value={info?.firstGrandPrix ?? "—"} label="First Grand Prix" />
                    </div>
                </ExSection>

                {info?.summary && (
                    <ExSection eyebrow="Profile" title="About">
                        <p className="ex-prose">{info.summary}</p>
                    </ExSection>
                )}

                {info?.famousFor && (
                    <ExSection eyebrow="Reputation" title="Famous For">
                        <p className="ex-prose">{info.famousFor}</p>
                    </ExSection>
                )}

                {(info?.weatherImpact || info?.overtakingDifficulty) && (
                    <ExSection eyebrow="Race Craft" title="Circuit Character">
                        <div className="ex-cols">
                            {info?.overtakingDifficulty && (
                                <div>
                                    <span className="ex-eyebrow">OVERTAKING</span>
                                    <p className="ex-prose">{info.overtakingDifficulty}</p>
                                    <p className="ex-prose" style={{ marginTop: 10 }}>
                                        <KnowMoreTerm term="dirty_air" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Dirty air</KnowMoreTerm>
                                        {" and "}
                                        <KnowMoreTerm term="downforce" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>downforce</KnowMoreTerm>
                                        {" setup are the two biggest factors here."}
                                    </p>
                                </div>
                            )}
                            {info?.weatherImpact && (
                                <div>
                                    <span className="ex-eyebrow">WEATHER</span>
                                    <p className="ex-prose">{info.weatherImpact}</p>
                                    <p className="ex-prose" style={{ marginTop: 10 }}>
                                        {"Conditions directly affect "}
                                        <KnowMoreTerm term="tyre_degradation" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>tyre degradation</KnowMoreTerm>
                                        {" and "}
                                        <KnowMoreTerm term="tyre_warmup" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>tyre warm-up</KnowMoreTerm>
                                        {"."}
                                    </p>
                                </div>
                            )}
                        </div>
                    </ExSection>
                )}

                {info?.keyCorners?.length > 0 && (
                    <ExSection eyebrow="Track Guide" title="Key Corners">
                        <ul className="ex-timeline">
                            {info.keyCorners.map((corner, i) => (
                                <li key={i}>{corner}</li>
                            ))}
                        </ul>
                    </ExSection>
                )}

                {info?.history && (
                    <ExSection eyebrow="Heritage" title="History">
                        <p className="ex-prose">{info.history}</p>
                    </ExSection>
                )}

                {info?.funFacts?.length > 0 && (
                    <ExSection eyebrow="Paddock Notes" title="Fun Facts">
                        <ul className="ex-list">
                            {info.funFacts.map((fact, i) => (
                                <li key={i}>{fact}</li>
                            ))}
                        </ul>
                    </ExSection>
                )}
            </main>

            <KnowMoreModal info={selectedTerm} onClose={() => setSelectedTerm(null)} />
        </div>
    );
}

export default CircuitDetails;
