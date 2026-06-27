import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { circuitInfo } from "../data/circuitInfo";
import KnowMoreModal from "../components/KnowMoreModal";
import { knowMoreInfo } from "../data/knowMoreInfo";
import KnowMoreTerm from "../components/KnowMoreTerm";
import { formatSessionTime } from "../utils/timeUtils";

function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
    });
}

function GrandPrixDetails() {
    const { year, id } = useParams();
    const [race, setRace] = useState(null);
    const [results, setResults] = useState([]);
    const [qualifying, setQualifying] = useState([]);
    const [selectedTerm, setSelectedTerm] = useState(null);

    useEffect(() => {
        fetch(`http://localhost:3000/grandprixdashboard/${year}`)
            .then((res) => { if (!res.ok) return []; return res.json(); })
            .then((data) => {
                const selected = data.find((ele) => ele.round === id);
                setRace(selected);
            });
    }, [year, id]);

    useEffect(() => {
        fetch(`http://localhost:3000/grandprixdashboard/results/${year}/${id}`)
            .then((res) => { if (!res.ok) return []; return res.json(); })
            .then((data) => setResults(data));
    }, [year, id]);

    useEffect(() => {
        fetch(`http://localhost:3000/grandprixdashboard/qualifying/${year}/${id}`)
            .then((res) => { if (!res.ok) return []; return res.json(); })
            .then((data) => setQualifying(Array.isArray(data) ? data : []))
            .catch(() => setQualifying([]));
    }, [year, id]);

    if (!race) return <div className="loading">Loading...</div>;

    const now = new Date();
    const raceDate = new Date(race.date + "T00:00:00");
    const raceNotStarted = raceDate > now;

    const formattedDate = raceDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    const nextSessionKey = (() => {
        const checks = [
            [race.FirstPractice, "fp1"],
            [race.SecondPractice, "fp2"],
            [race.ThirdPractice, "fp3"],
            [race.Sprint, "sprint"],
            [race.Qualifying, "qualifying"],
            [{ date: race.date, time: race.time }, "race"],
        ];
        for (const [s, key] of checks) {
            if (!s?.date) continue;
            const t = s.time ? new Date(`${s.date}T${s.time}`) : new Date(s.date + "T00:00:00");
            if (t > now) return key;
        }
        return null;
    })();

    const fastestLap = results.find((r) => r.FastestLap?.rank === "1") || null;

    const biggestGainer =
        results.length > 0
            ? results.reduce((best, current) => {
                const currentGain = Number(current.grid) - Number(current.position);
                const bestGain = Number(best.grid) - Number(best.position);
                return currentGain > bestGain ? current : best;
            }, results[0])
            : null;
    const positionsGained = biggestGainer
        ? Number(biggestGainer.grid) - Number(biggestGainer.position)
        : 0;

    const teamPerformance = {};
    results.forEach((result) => {
        const teamName = result.Constructor.name;
        if (!teamPerformance[teamName]) {
            teamPerformance[teamName] = { points: 0, drivers: [] };
        }
        teamPerformance[teamName].points += Number(result.points);
        teamPerformance[teamName].drivers.push({
            position: result.position,
            name: `${result.Driver.givenName} ${result.Driver.familyName}`,
        });
    });
    const sortedTeams = Object.entries(teamPerformance)
        .map(([name, data]) => ({ name, points: data.points, drivers: data.drivers }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 3);

    const circuitData = circuitInfo[race?.Circuit?.circuitId];

    return (
        <div className="page detail-page">
            <h1>{race.raceName}</h1>
            <p>
                <a href={race.url} target="_blank" rel="noreferrer">
                    {race.raceName} Wikipedia Page
                </a>
            </p>

            <h2>Race Info</h2>
            <div className="info-card" style={{ padding: "16px 20px" }}>
                <div className="detail-info-row">
                    <span className="detail-info-label">Date</span>
                    <span className="detail-info-value">{formattedDate}</span>
                </div>
                <div className="detail-info-row">
                    <span className="detail-info-label">Circuit</span>
                    <span className="detail-info-value">{race.Circuit.circuitName}</span>
                </div>
                <div className="detail-info-row">
                    <span className="detail-info-label">Location</span>
                    <span className="detail-info-value">
                        {race.Circuit.Location.locality}, {race.Circuit.Location.country}
                    </span>
                </div>
                <div className="detail-info-row">
                    <span className="detail-info-label">Round</span>
                    <span className="detail-info-value">Round {race.round} of the {year} season</span>
                </div>
            </div>

            <h2>Weekend Schedule</h2>
            <div className="info-card" style={{ padding: "16px 20px" }}>
                {race.FirstPractice && (
                    <div className={`detail-info-row${nextSessionKey === "fp1" ? " next-session-highlight" : ""}`}>
                        <span className="detail-info-label">
                            <KnowMoreTerm term="fp1" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Practice 1</KnowMoreTerm>
                            {nextSessionKey === "fp1" && <span className="next-session-badge">Next</span>}
                        </span>
                        <span className="detail-info-value">{formatSessionTime(race.FirstPractice.date, race.FirstPractice.time)}</span>
                    </div>
                )}
                {race.SecondPractice && (
                    <div className={`detail-info-row${nextSessionKey === "fp2" ? " next-session-highlight" : ""}`}>
                        <span className="detail-info-label">
                            <KnowMoreTerm term="fp2" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Practice 2</KnowMoreTerm>
                            {nextSessionKey === "fp2" && <span className="next-session-badge">Next</span>}
                        </span>
                        <span className="detail-info-value">{formatSessionTime(race.SecondPractice.date, race.SecondPractice.time)}</span>
                    </div>
                )}
                {race.ThirdPractice && (
                    <div className={`detail-info-row${nextSessionKey === "fp3" ? " next-session-highlight" : ""}`}>
                        <span className="detail-info-label">
                            <KnowMoreTerm term="fp3" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Practice 3</KnowMoreTerm>
                            {nextSessionKey === "fp3" && <span className="next-session-badge">Next</span>}
                        </span>
                        <span className="detail-info-value">{formatSessionTime(race.ThirdPractice.date, race.ThirdPractice.time)}</span>
                    </div>
                )}
                {race.Sprint && (
                    <div className={`detail-info-row${nextSessionKey === "sprint" ? " next-session-highlight" : ""}`}>
                        <span className="detail-info-label">
                            <KnowMoreTerm term="sprint" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Sprint</KnowMoreTerm>
                            {nextSessionKey === "sprint" && <span className="next-session-badge">Next</span>}
                        </span>
                        <span className="detail-info-value">{formatSessionTime(race.Sprint.date, race.Sprint.time)}</span>
                    </div>
                )}
                {race.Qualifying && (
                    <div className={`detail-info-row${nextSessionKey === "qualifying" ? " next-session-highlight" : ""}`}>
                        <span className="detail-info-label">
                            <KnowMoreTerm term="qualifying" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Qualifying</KnowMoreTerm>
                            {nextSessionKey === "qualifying" && <span className="next-session-badge">Next</span>}
                        </span>
                        <span className="detail-info-value">{formatSessionTime(race.Qualifying.date, race.Qualifying.time)}</span>
                    </div>
                )}
                <div className={`detail-info-row${nextSessionKey === "race" ? " next-session-highlight" : ""}`} style={{ borderTop: "1px solid #f0f0f0", paddingTop: 10, marginTop: 4 }}>
                    <span className="detail-info-label" style={{ color: "#E10600" }}>
                        Race
                        {nextSessionKey === "race" && <span className="next-session-badge">Next</span>}
                    </span>
                    <span className="detail-info-value" style={{ fontWeight: 600 }}>{formatSessionTime(race.date, race.time) !== "TBA" ? formatSessionTime(race.date, race.time) : formattedDate}</span>
                </div>
            </div>

            {raceNotStarted && (
                <div className="info-card" style={{ marginTop: 20 }}>
                    <h3>Upcoming Race</h3>
                    <p>This race has not taken place yet.</p>
                    <p>
                        Race results, qualifying results, fastest lap, podium finishers
                        and race statistics will be available after the race weekend.
                    </p>
                </div>
            )}

            {!raceNotStarted && results.length > 0 && (
                <>
                    <h2>
                        <KnowMoreTerm term="podium" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Podium</KnowMoreTerm>
                    </h2>
                    <div className="race-summary-card">
                        <div className="podium-grid">
                            <div className="podium-card podium-first">
                                <span className="podium-medal">P1</span>
                                <span className="podium-name">
                                    {results[0].Driver.givenName} {results[0].Driver.familyName}
                                </span>
                                <span className="podium-team">{results[0].Constructor.name}</span>
                                <span className="podium-team">{results[0].points} pts</span>
                            </div>
                            {results[1] && (
                                <div className="podium-card podium-second">
                                    <span className="podium-medal">P2</span>
                                    <span className="podium-name">
                                        {results[1].Driver.givenName} {results[1].Driver.familyName}
                                    </span>
                                    <span className="podium-team">{results[1].Constructor.name}</span>
                                    <span className="podium-team">{results[1].points} pts</span>
                                </div>
                            )}
                            {results[2] && (
                                <div className="podium-card podium-third">
                                    <span className="podium-medal">P3</span>
                                    <span className="podium-name">
                                        {results[2].Driver.givenName} {results[2].Driver.familyName}
                                    </span>
                                    <span className="podium-team">{results[2].Constructor.name}</span>
                                    <span className="podium-team">{results[2].points} pts</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <h2>Race Highlights</h2>
                    <div className="stat-row">
                        {qualifying.length > 0 && (
                            <div className="stat-box">
                                <span className="stat-value">
                                    {qualifying[0].Driver.givenName} {qualifying[0].Driver.familyName}
                                </span>
                                <span className="stat-label">
                                    <KnowMoreTerm term="pole_position" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Pole</KnowMoreTerm>
                                    {" — "}{qualifying[0].Q3 || qualifying[0].Q2 || qualifying[0].Q1}
                                </span>
                            </div>
                        )}
                        {fastestLap && (
                            <div className="stat-box">
                                <span className="stat-value">
                                    {fastestLap.Driver.givenName} {fastestLap.Driver.familyName}
                                </span>
                                <span className="stat-label">
                                    <KnowMoreTerm term="fastest_lap" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Fastest Lap</KnowMoreTerm>
                                    {" — "}{fastestLap.FastestLap.Time.time} (Lap {fastestLap.FastestLap.lap})
                                </span>
                            </div>
                        )}
                        {biggestGainer && positionsGained > 0 && (
                            <div className="stat-box">
                                <span className="stat-value">
                                    {biggestGainer.Driver.givenName} {biggestGainer.Driver.familyName}
                                </span>
                                <span className="stat-label">
                                    Biggest Gainer — P{biggestGainer.grid} to P{biggestGainer.position} (+{positionsGained})
                                </span>
                            </div>
                        )}
                    </div>

                    <h2>
                        <KnowMoreTerm term="qualifying" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Qualifying</KnowMoreTerm>
                    </h2>
                    <div className="list-grid">
                        {qualifying.slice(0, 10).map((driver) => (
                            <div key={driver.position} className="list-card">
                                <h3>P{driver.position} · {driver.Driver.givenName} {driver.Driver.familyName}</h3>
                                <p>{driver.Constructor.name}</p>
                                {driver.Q3 && <p>Q3: {driver.Q3}</p>}
                                {!driver.Q3 && driver.Q2 && <p>Q2: {driver.Q2}</p>}
                                {!driver.Q3 && !driver.Q2 && <p>Q1: {driver.Q1 || "—"}</p>}
                            </div>
                        ))}
                    </div>

                    <h2>Race Results</h2>
                    <div className="list-grid">
                        {results.map((result) => (
                            <div key={result.position} className="list-card">
                                <h3>P{result.position} · {result.Driver.givenName} {result.Driver.familyName}</h3>
                                <p>{result.Constructor.name}</p>
                                <p>Grid P{result.grid}</p>
                                {result.status !== "Finished" && !result.status.startsWith("+") && (
                                    <p>
                                        <KnowMoreTerm term="retirement" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Retired</KnowMoreTerm>
                                        {" — "}{result.status}
                                    </p>
                                )}
                                <p className="list-date">{result.points} pts</p>
                            </div>
                        ))}
                    </div>

                    <h2>Top Teams</h2>
                    <div className="list-grid">
                        {sortedTeams.map((team) => (
                            <div key={team.name} className="list-card">
                                <h3>{team.name}</h3>
                                {team.drivers.map((driver) => (
                                    <p key={driver.name}>P{driver.position} — {driver.name}</p>
                                ))}
                                <p className="list-date">{team.points} pts</p>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {circuitData && (
                <>
                    <h2>About the Circuit</h2>
                    <p>{circuitData.summary}</p>

                    <h2>Circuit Stats</h2>
                    <div className="stat-row">
                        <div className="stat-box">
                            <span className="stat-value">{circuitData.laps}</span>
                            <span className="stat-label">Laps</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-value">{circuitData.turns}</span>
                            <span className="stat-label">Turns</span>
                        </div>
                        <div className="stat-box">
                            <span className="stat-value">{circuitData.drsZones}</span>
                            <span className="stat-label">
                                <KnowMoreTerm term="drs" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>DRS</KnowMoreTerm>
                                {" Zones"}
                            </span>
                        </div>
                    </div>
                    <div className="info-card" style={{ padding: "16px 20px", marginTop: 14 }}>
                        <div className="detail-info-row">
                            <span className="detail-info-label">Track Length</span>
                            <span className="detail-info-value">{circuitData.length}</span>
                        </div>
                        <div className="detail-info-row">
                            <span className="detail-info-label">Race Distance</span>
                            <span className="detail-info-value">{circuitData.raceDistance}</span>
                        </div>
                        {circuitData.lapRecord && (
                            <div className="detail-info-row">
                                <span className="detail-info-label">
                                    <KnowMoreTerm term="fastest_lap" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Lap Record</KnowMoreTerm>
                                </span>
                                <span className="detail-info-value">
                                    {circuitData.lapRecord} — {circuitData.lapRecordHolder} ({circuitData.lapRecordYear})
                                </span>
                            </div>
                        )}
                        <div className="detail-info-row">
                            <span className="detail-info-label">First Grand Prix</span>
                            <span className="detail-info-value">{circuitData.firstGrandPrix}</span>
                        </div>
                        {circuitData.trackType && (
                            <div className="detail-info-row">
                                <span className="detail-info-label">Track Type</span>
                                <span className="detail-info-value">{circuitData.trackType}</span>
                            </div>
                        )}
                    </div>

                    {circuitData.famousFor && (
                        <>
                            <h2>Famous For</h2>
                            <p>{circuitData.famousFor}</p>
                        </>
                    )}

                    {circuitData.keyCorners?.length > 0 && (
                        <>
                            <h2>Key Corners</h2>
                            <ul>
                                {circuitData.keyCorners.map((corner, i) => (
                                    <li key={i}>{corner}</li>
                                ))}
                            </ul>
                        </>
                    )}

                    {circuitData.funFacts?.length > 0 && (
                        <>
                            <h2>Fun Facts</h2>
                            <ul>
                                {circuitData.funFacts.map((fact, i) => (
                                    <li key={i}>{fact}</li>
                                ))}
                            </ul>
                        </>
                    )}
                </>
            )}

            <KnowMoreModal info={selectedTerm} onClose={() => setSelectedTerm(null)} />
        </div>
    );
}

export default GrandPrixDetails;
