import {useParams} from "react-router-dom";
import {useState,useEffect} from "react";
import { circuitInfo } from "../data/circuitInfo";
import KnowMoreModal from "../components/KnowMoreModal";
import { knowMoreInfo } from "../data/knowMoreInfo";
import KnowMoreTerm from "../components/KnowMoreTerm";

function CircuitDetails(){
    const {id}=useParams()
    const [circuit,setCircuit]=useState(null)
    const [selectedTerm, setSelectedTerm] = useState(null)

    useEffect(()=>{
        fetch("http://localhost:3000/circuitmaps")
        .then((res)=>res.json())
        .then((data)=>{
            const selected = data.find((ele)=>ele.circuitId===id)
            setCircuit(selected)
        })
    },[id])
    if (!circuit) {
        return <div className="loading">Loading...</div>
    }
    const extraInfo = circuitInfo[id];
    return(
        <div className="page detail-page">
            <h1>{circuit.circuitName}</h1>
            <p>{extraInfo?.summary}</p>
            <p><a href={circuit.url} target="_blank">{circuit.circuitName}'s Wikipedia Profile</a></p>

            <h2>Circuit Layout</h2>
            {extraInfo?.mapImage && (
                <img
                    className="circuit-map"
                    src={extraInfo.mapImage}
                    alt={`${circuit.circuitName} Layout`}
                />
            )}

            <h2>Track Information</h2>
            <div className="stat-row">
                <div className="stat-box">
                    <span className="stat-value">{extraInfo?.laps ?? '—'}</span>
                    <span className="stat-label">Laps</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{extraInfo?.turns ?? '—'}</span>
                    <span className="stat-label">Turns</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{extraInfo?.drsZones ?? '—'}</span>
                    <span className="stat-label">DRS Zones</span>
                </div>
            </div>
            <p>Track Type: {extraInfo?.trackType}</p>
            <p>Length: {extraInfo?.length}</p>
            <p>
                <KnowMoreTerm term="drs" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>DRS</KnowMoreTerm>
                {" Zones: "}{extraInfo?.drsZones}
            </p>
            <p>Location: {circuit.Location.locality}, {circuit.Location.country}</p>
            <p>Latitude: {circuit.Location.lat}</p>
            <p>Longitude: {circuit.Location.long}</p>

            <h2>Lap Record</h2>
            <p>{extraInfo?.lapRecord} — {extraInfo?.lapRecordHolder} ({extraInfo?.lapRecordYear})</p>

            <h2>Difficulty</h2>
            <p>{extraInfo?.difficulty}</p>
            <p>Rating: {extraInfo?.difficultyRating}/5</p>
            <p>Overtaking: {extraInfo?.overtakingDifficulty}</p>

            <h2>Weather Impact</h2>
            <p>{extraInfo?.weatherImpact}</p>

            <h2>Key Corners</h2>
            <ul>{extraInfo?.keyCorners?.map((corner,index)=>(
                <li key={index}>{corner}</li>
            ))}</ul>

            <h2>History</h2>
            <p>{extraInfo?.history}</p>

            <h2>Fun Facts</h2>
            <ul>{extraInfo?.funFacts?.map((fact,index)=>(
                <li key={index}>{fact}</li>
            ))}</ul>

            <KnowMoreModal
                info={selectedTerm}
                onClose={() => setSelectedTerm(null)}
            />
        </div>
    )
}
export default CircuitDetails;
