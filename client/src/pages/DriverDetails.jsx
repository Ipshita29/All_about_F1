import {useParams} from "react-router-dom";
import {useState,useEffect} from "react";

function DriverDetails(){
    const {id}=useParams()
    const [driver,setDriver]=useState(null)
    useEffect(()=>{
        fetch("http://localhost:3000/drivers")
        .then((res)=>res.json())
        .then((data)=>{
            const selected = data.find((ele)=>ele.driverId===id)
            setDriver(selected)
        })
    },[id])
    if (!driver) {
    return <h1>Loading...</h1>}
    return(
        <div>
            <h1> {driver.givenName} {driver.familyName}</h1>
            <p>Nationality: {driver.nationality}</p>
            <p>Date of Birth: {driver.dateOfBirth}</p>
            <p>Number: {driver.permanentNumber}</p>
            <p>URL:<a href={driver.url} target="_blank">{driver.familyName}'s Wikipedia Profile</a></p>

        </div>
    )
}
export default DriverDetails;
