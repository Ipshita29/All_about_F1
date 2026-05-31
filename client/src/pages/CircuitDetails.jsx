import {useParams} from "react-router-dom";
import {useState,useEffect} from "react";

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
    return(
        <div>
            <h1> {circuit.circuitName}</h1>
            <p>Location: {circuit.Location.locality}, {circuit.Location.country}</p>
            <p>Latitube: {circuit.Location.lat}</p>
            <p>Longitude: {circuit.Location.long}</p>
            <p>URL:<a href={circuit.url} target="_blank">{circuit.circuitName}'s Wikipedia Profile</a></p>

        </div>
    )
}
export default CircuitDetails;
