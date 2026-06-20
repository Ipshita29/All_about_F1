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
      .then((res) => {
        if(!res.ok){
          return []
        }
          return res.json()})
      .then((data) => {
        const selected = data.find((ele) => ele.round === id);
        setRace(selected);
      });
  }, [year, id]);
  useEffect(() => {
    fetch(`http://localhost:3000/grandprixdashboard/results/${year}/${id}`)
      .then((res) => {
        if (!res.ok) {return []}
        return res.json()})
      .then((data) => setResults(data));
  }, [year, id]);
  useEffect(() => {
    fetch(`http://localhost:3000/grandprixdashboard/qualifying/${year}/${id}`)
      .then((res) => {
        if (!res.ok){
          return []
        }
        return res.json()})
      .then((data) => {
        setQualifying(Array.isArray(data) ? data : []);
      })
      .catch(() => setQualifying([]));
  }, [year, id]);

  if (!race) {
    return <div className="loading">Loading...</div>;
  }
  const raceDate = new Date(race.date)
  const today = new Date()
  const raceNotStarted = raceDate>today
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
  const fastestLap =Array.isArray(results)
    ? results.find((result) => result.FastestLap) || null
    : null;
  const teamPerformance = {};

  results.forEach((result) => {
    const teamName = result.Constructor.name;

    if (!teamPerformance[teamName]) {
      teamPerformance[teamName] = {
        points: 0,
        drivers: [],
      };
    }

    teamPerformance[teamName].points += Number(result.points);

    teamPerformance[teamName].drivers.push({
      position: result.position,
      name: `${result.Driver.givenName} ${result.Driver.familyName}`,
    });
  });
  const sortedTeams = Object.entries(teamPerformance)
    .map(([name, data]) => ({
      name,
      points: data.points,
      drivers: data.drivers,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);
  const circuitId = race?.Circuit?.circuitId;
  const circuitData = circuitInfo[circuitId];
  return (
    <div className="page detail-page">
      <h1>{race.raceName}</h1>
      <p>
        <a href={race.url} target="_blank" rel="noreferrer">
          {race.raceName} Wikipedia Page
        </a>
      </p>

      <h2>Race Info</h2>
      <p>
        Date:{" "}
        {new Date(race.date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
      <p>Circuit: {race.Circuit.circuitName}</p>
      <p>Locality: {race.Circuit.Location.locality}</p>
      <p>Country: {race.Circuit.Location.country}</p>

      <h2>Weekend Schedule</h2>
      <p>Practice 1: {race.FirstPractice?.date || "N/A"}</p>
      <p>Practice 2: {race.SecondPractice?.date || "N/A"}</p>
      <p>Practice 3: {race.ThirdPractice?.date || "N/A"}</p>
      <p>Qualifying: {race.Qualifying?.date || "N/A"}</p>
      <p>Sprint: {race.Sprint?.date || "N/A"}</p>

      {raceNotStarted && (
        <div className="info-card">
          <h2>Race Status</h2>
          <p>This race has not taken place yet.</p>
          <p>
            Race results, qualifying results,
            fastest lap, podium finishers and
            race statistics will be available
            after the race weekend.
          </p>
        </div>
      )}
      {!raceNotStarted && (
        <>
          <h2>Podium</h2>
      {results.length > 0 && (
        <>
          <p>
            {results[0]?.Driver.givenName} {results[0]?.Driver.familyName}
          </p>

          <p>
            {results[1]?.Driver.givenName} {results[1]?.Driver.familyName}
          </p>

          <p>
            {results[2]?.Driver.givenName} {results[2]?.Driver.familyName}
          </p>
        </>
      )}
      <h2>Practice Sessions</h2>

      <div className="stat-row">
        <div className="stat-box">
          <span className="stat-label">FP1</span>
          <span className="stat-value">{race.FirstPractice?.date}</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">FP2</span>
          <span className="stat-value">{race.SecondPractice?.date}</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">FP3</span>
          <span className="stat-value">{race.ThirdPractice?.date}</span>
        </div>
      </div>

      <h2>Qualifying Results</h2>

      <div className="list-grid">
        {qualifying.slice(0, 10).map((driver) => (
          <div key={driver.position} className="list-card">
            <h3>
              P{driver.position} · {driver.Driver.givenName}{" "}
              {driver.Driver.familyName}
            </h3>

            <p>{driver.Constructor.name}</p>

            <p>Q3: {driver.Q3 || "-"}</p>
          </div>
        ))}
      </div>
      <h2>Pole Position</h2>

      {qualifying.length > 0 && (
        <div className="stat-box">
          <span className="stat-value">
            {qualifying[0].Driver.givenName} {qualifying[0].Driver.familyName}
          </span>
          <span className="stat-label">{qualifying[0].Q3}</span>
        </div>
      )}
      <h2>⚡ Fastest Lap</h2>

      {fastestLap && (
        <div className="highlight-card">
          <h3>
            {fastestLap.Driver.givenName} {fastestLap.Driver.familyName}
          </h3>

          <p>{fastestLap.FastestLap.Time.time}</p>

          <p>Lap {fastestLap.FastestLap.lap}</p>
        </div>
      )}
      <h2>Race Results</h2>

      <div className="list-grid">
        {results.map((result) => (
          <div key={result.position} className="list-card">
            <h3>
              P{result.position} · {result.Driver.givenName}{" "}
              {result.Driver.familyName}
            </h3>

            <p>{result.Constructor.name}</p>

            <p>
              Started P{result.grid}
              {" → "}
              Finished P{result.position}
            </p>

            <p>{result.points} pts</p>
          </div>
        ))}
      </div>

      <h2>Race Winner</h2>

      {results.length > 0 && (
        <div className="stat-box">
          <span className="stat-value">
            {results[0].Driver.givenName} {results[0].Driver.familyName}
          </span>

          <span className="stat-label">{results[0].Constructor.name}</span>
        </div>
      )}
      <h2>Team Performance</h2>

      <div className="list-grid">
        {sortedTeams.map((team) => (
          <div key={team.name} className="list-card">
            <h3>{team.name}</h3>

            {team.drivers.map((driver) => (
              <p key={driver.name}>
                P{driver.position} {driver.name}
              </p>
            ))}

            <p>
              <strong>{team.points} Points</strong>
            </p>
          </div>
        ))}
      </div>
      <h2>Biggest Gainer</h2>

      {biggestGainer && (
        <div className="stat-box">
          <span className="stat-value">
            {biggestGainer.Driver.givenName} {biggestGainer.Driver.familyName}
          </span>

          <span className="stat-label">
            Started P{biggestGainer.grid}
            {" → "}
            Finished P{biggestGainer.position}
          </span>

          <p>+{positionsGained} positions</p>
        </div>
      )}
        </>
      )}
      {circuitData && (
        <section className="circuit-overview">
          <h2>Circuit Guide</h2>

          <h3>{race.Circuit.circuitName}</h3>

          <p>{circuitData.summary}</p>
          <h2>Circuit Statistics</h2>

          <div className="list-grid">
            <div className="list-card">
              <h3>Length</h3>
              <p>{circuitData.length}</p>
            </div>

            <div className="list-card">
              <h3>Turns</h3>
              <p>{circuitData.turns}</p>
            </div>

            <div className="list-card">
              <h3>DRS Zones</h3>
              <p>{circuitData.drsZones}</p>
            </div>

            <div className="list-card">
              <h3>Laps</h3>
              <p>{circuitData.laps}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default GrandPrixDetails;
