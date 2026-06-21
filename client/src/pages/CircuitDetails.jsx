import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { circuitInfo } from "../data/circuitInfo";
import KnowMoreModal from "../components/KnowMoreModal";
import { knowMoreInfo } from "../data/knowMoreInfo";
import KnowMoreTerm from "../components/KnowMoreTerm";

function CircuitDetails() {
    const { id } = useParams();
    const [circuit, setCircuit] = useState(null);
    const [selectedTerm, setSelectedTerm] = useState(null);

    useEffect(() => {
        fetch("http://localhost:3000/circuitmaps")
            .then((res) => res.json())
            .then((data) => {
                const selected = data.find((ele) => ele.circuitId === id);
                setCircuit(selected);
            });
    }, [id]);

    if (!circuit) return <div className="loading">Loading...</div>;

    const info = circuitInfo[id];

    return (
        <div className="page detail-page">

            <h1>{circuit.circuitName}</h1>
            <p>{info?.trackType} · {circuit.Location.locality}, {circuit.Location.country}</p>
            <p>
                <a href={circuit.url} target="_blank" rel="noreferrer">
                    {circuit.circuitName} Wikipedia Profile
                </a>
            </p>

            <h2>Track Information</h2>
            <div className="stat-row">
                <div className="stat-box">
                    <span className="stat-value">{info?.laps ?? "—"}</span>
                    <span className="stat-label">Laps</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{info?.turns ?? "—"}</span>
                    <span className="stat-label">Turns</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{info?.drsZones ?? "—"}</span>
                    <span className="stat-label">
                        <KnowMoreTerm term="drs" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>
                            DRS
                        </KnowMoreTerm>
                        {" Zones"}
                    </span>
                </div>
            </div>
            <p>Track Length: {info?.length ?? "—"}</p>
            <p>Race Distance: {info?.raceDistance ?? "—"}</p>

            {info?.lapRecord && (
                <>
                    <h2>Lap Record</h2>
                    <div className="stat-row">
                        <div className="stat-box">
                            <span className="stat-value">{info.lapRecord}</span>
                            <span className="stat-label">
                                <KnowMoreTerm term="fastest_lap" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>
                                    Lap Record
                                </KnowMoreTerm>
                            </span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-value">{info.lapRecordHolder}</span>
                            <span className="stat-label">Record Holder</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-value">{info.lapRecordYear}</span>
                            <span className="stat-label">Year Set</span>
                        </div>
                    </div>
                </>
            )}

            <h2>Circuit Profile</h2>
            <div className="stat-row">
                <div className="stat-box">
                    <span className="stat-value">{info?.difficulty ?? "—"}</span>
                    <span className="stat-label">Difficulty</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{info?.difficultyRating ?? "—"}/5</span>
                    <span className="stat-label">Rating</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{info?.firstGrandPrix ?? "—"}</span>
                    <span className="stat-label">First Grand Prix</span>
                </div>
            </div>

            {info?.mapImage && (
                <>
                    <h2>Circuit Layout</h2>
                    <img
                        className="circuit-map"
                        src={info.mapImage}
                        alt={`${circuit.circuitName} Layout`}
                    />
                </>
            )}

            {info?.summary && (
                <>
                    <h2>About</h2>
                    <p>{info.summary}</p>
                </>
            )}

            {info?.famousFor && (
                <>
                    <h2>Famous For</h2>
                    <p>{info.famousFor}</p>
                </>
            )}

            {(info?.weatherImpact || info?.overtakingDifficulty) && (
                <>
                    <h2>Circuit Character</h2>
                    <div className="info-card">
                        {info?.overtakingDifficulty && (
                            <>
                                <h3>Overtaking</h3>
                                <p>{info.overtakingDifficulty}</p>
                                <p>
                                    <KnowMoreTerm term="dirty_air" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Dirty air</KnowMoreTerm>
                                    {" and "}
                                    <KnowMoreTerm term="downforce" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>downforce</KnowMoreTerm>
                                    {" setup are the two biggest factors behind how challenging overtaking is here."}
                                </p>
                            </>
                        )}
                        {info?.weatherImpact && (
                            <>
                                <h3>Weather</h3>
                                <p>{info.weatherImpact}</p>
                                <p>
                                    {"Track conditions directly affect "}
                                    <KnowMoreTerm term="tyre_degradation" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>tyre degradation</KnowMoreTerm>
                                    {" and "}
                                    <KnowMoreTerm term="tyre_warmup" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>tyre warm-up</KnowMoreTerm>
                                    {" rates across the race distance."}
                                </p>
                            </>
                        )}
                    </div>
                </>
            )}

            {info?.keyCorners?.length > 0 && (
                <>
                    <h2>Key Corners</h2>
                    <p>
                        {"These sections demand precise "}
                        <KnowMoreTerm term="apex" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>apex</KnowMoreTerm>
                        {" choice — "}
                        <KnowMoreTerm term="chicane" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>chicane</KnowMoreTerm>
                        {" and "}
                        <KnowMoreTerm term="hairpin" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>hairpin</KnowMoreTerm>
                        {" sections typically offer the best overtaking opportunities."}
                    </p>
                    <ul>
                        {info.keyCorners.map((corner, i) => (
                            <li key={i}>{corner}</li>
                        ))}
                    </ul>
                </>
            )}

            {info?.history && (
                <>
                    <h2>History</h2>
                    <p>{info.history}</p>
                </>
            )}

            {info?.funFacts?.length > 0 && (
                <>
                    <h2>Fun Facts</h2>
                    <ul>
                        {info.funFacts.map((fact, i) => (
                            <li key={i}>{fact}</li>
                        ))}
                    </ul>
                </>
            )}

            <KnowMoreModal info={selectedTerm} onClose={() => setSelectedTerm(null)} />

        </div>
    );
}

export default CircuitDetails;
