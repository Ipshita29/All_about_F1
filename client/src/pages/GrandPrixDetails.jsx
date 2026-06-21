import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { circuitInfo } from "../data/circuitInfo";

function GrandPrixDetails() {
  const { year, id } = useParams();
  const [race, setRace] = useState(null);
  const [results, setResults] = useState([]);
  const [qualifying, setQualifying] = useState([]);

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

  const raceDate = new Date(race.date);
  const raceNotStarted = raceDate > new Date();

  const formattedDate = raceDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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
      <p>Date: {formattedDate}</p>
      <p>Circuit: {race.Circuit.circuitName}</p>
      <p>Location: {race.Circuit.Location.locality}, {race.Circuit.Location.country}</p>
      <p>Round: {race.round} of the {year} season</p>

      <h2>Weekend Schedule</h2>
      {race.FirstPractice && <p>Practice 1: {race.FirstPractice.date}</p>}
      {race.SecondPractice && <p>Practice 2: {race.SecondPractice.date}</p>}
      {race.ThirdPractice && <p>Practice 3: {race.ThirdPractice.date}</p>}
      {race.Sprint && <p>Sprint: {race.Sprint.date}</p>}
      {race.Qualifying && <p>Qualifying: {race.Qualifying.date}</p>}
      <p>Race: {formattedDate}</p>

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
          <h2>Podium</h2>
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
                  Pole — {qualifying[0].Q3 || qualifying[0].Q2 || qualifying[0].Q1}
                </span>
              </div>
            )}
            {fastestLap && (
              <div className="stat-box">
                <span className="stat-value">
                  {fastestLap.Driver.givenName} {fastestLap.Driver.familyName}
                </span>
                <span className="stat-label">
                  Fastest Lap — {fastestLap.FastestLap.Time.time} (Lap {fastestLap.FastestLap.lap})
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

          <h2>Qualifying</h2>
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
                <p>Started P{result.grid}</p>
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
              <span className="stat-label">DRS Zones</span>
            </div>
          </div>
          <p>Track Length: {circuitData.length}</p>
          <p>Race Distance: {circuitData.raceDistance}</p>
          {circuitData.lapRecord && (
            <p>
              Lap Record: {circuitData.lapRecord} — {circuitData.lapRecordHolder} ({circuitData.lapRecordYear})
            </p>
          )}
          <p>First Grand Prix: {circuitData.firstGrandPrix}</p>
          {circuitData.trackType && <p>Track Type: {circuitData.trackType}</p>}

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
    </div>
  );
}

export default GrandPrixDetails;
