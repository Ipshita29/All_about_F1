import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";

function GrandPrixDetails() {
    const { id } = useParams();
    const [race, setRace] = useState(null);
    useEffect(() => {
        fetch("http://localhost:3000/grandprixdashboard")
            .then((res) => res.json())
            .then((data) => {
                const selected = data.find(
                    (ele) => ele.round === id)
                    setRace(selected)
            });
    }, [id]);
    if (!race) {
        return <h1>Loading...</h1>;
    }
    return (
        <div>
            <h1>{race.raceName}</h1>
            <p>Date: {race.date}</p>
            <p>Circuit: {race.Circuit.circuitName}</p>
            <p>Locality: {race.Circuit.Location.locality}</p>
            <p>Country: {race.Circuit.Location.country}</p>
            <p>URL:<a href={race.url} target="_blank" rel="noreferrer">{race.raceName} Wikipedia Page</a></p>
        </div>
    );
}

export default GrandPrixDetails;