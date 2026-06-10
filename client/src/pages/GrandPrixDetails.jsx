import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";

function GrandPrixDetails() {
    const { year,id } = useParams();
    const [race, setRace] = useState(null);
    useEffect(() => {
        fetch(`http://localhost:3000/grandprixdashboard/${year}`)
            .then((res) => res.json())
            .then((data) => {
                const selected = data.find(
                    (ele) => ele.round === id)
                    setRace(selected)
            });
    }, [id]);
    if (!race) {
        return <div className="loading">Loading...</div>;
    }
    return (
        <div className="page detail-page">
            <h1>{race.raceName}</h1>
            <p><a href={race.url} target="_blank" rel="noreferrer">{race.raceName} Wikipedia Page</a></p>

            <h2>Race Info</h2>
            <p>Date: {new Date(race.date).toLocaleDateString("en-GB", {day:"numeric", month:"long", year:"numeric"})}</p>
            <p>Circuit: {race.Circuit.circuitName}</p>
            <p>Locality: {race.Circuit.Location.locality}</p>
            <p>Country: {race.Circuit.Location.country}</p>
        </div>
    );
}

export default GrandPrixDetails;
