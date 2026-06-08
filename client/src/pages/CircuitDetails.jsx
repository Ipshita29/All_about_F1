import {useParams} from "react-router-dom";
import {useState,useEffect} from "react";
import { circuitInfo } from "../data/circuitInfo";

function CircuitDetails(){
    const {id}=useParams()
    const [circuit,setCircuit]=useState(null)
    useEffect(()=>{
        fetch("http://localhost:3000/circuitmaps")
        .then((res)=>res.json())
        .then((data)=>{
            const selected = data.find((ele)=>ele.circuitId===id)
            setCircuit(selected)
        })
    },[id])
    if (!circuit) {
    return <h1>Loading...</h1>}
    const extraInfo = circuitInfo[id];
    return(
        <div className="page">
            <h1> {circuit.circuitName}</h1>
            <p>{extraInfo?.summary}</p>
            <p>URL:<a href={circuit.url} target="_blank">{circuit.circuitName}'s Wikipedia Profile</a></p>

            <h2>Circuit Layout</h2>

            {extraInfo?.mapImage && (
            <img
                className="circuit-map"
                src={extraInfo.mapImage}
                alt={`${circuit.circuitName} Layout`}
            />
            )}

            <h2>Track Information</h2>

            <p>Track Type: {extraInfo?.trackType}</p>
            <p>Length: {extraInfo?.length}</p>
            <p>Laps: {extraInfo?.laps}</p>
            <p>Turns: {extraInfo?.turns}</p>
            <p>DRS Zones: {extraInfo?.drsZones}</p>
            <p>Location: {circuit.Location.locality}, {circuit.Location.country}</p>
            <p>Latitube: {circuit.Location.lat}</p>
            <p>Longitude: {circuit.Location.long}</p>

            <h2>Lap Record</h2>
            <p>
            {extraInfo?.lapRecord}
            {" - "}
            {extraInfo?.lapRecordHolder}
            {" ("}
            {extraInfo?.lapRecordYear}
            {")"}
            </p>

            <h2>Difficulty</h2>
            <p>{extraInfo?.difficulty}</p>
            <p>Rating: {extraInfo?.difficultyRating}/5</p>
            <p>Overtaking: {extraInfo?.overtakingDifficulty}</p>

            <h2>Weather Impact</h2>
            <p>{extraInfo?.weatherImpact}</p>

            <h2>Key Corners</h2>
            <ul>{extraInfo?.keyCorners?.map((corner,index)=>(
                <li key={index}>{corner}</li>
            ))}
            </ul>

            <h2>History</h2>
            <p>{extraInfo?.history}</p>

            <h2>Fun Facts</h2>
            <ul>{extraInfo?.funFacts?.map((fact,index)=>(
                <li key={index}>{fact}</li>
            ))}
            </ul>

        </div>
    )
}
export default CircuitDetails;
