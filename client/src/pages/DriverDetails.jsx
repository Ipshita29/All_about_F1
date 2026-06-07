import {useParams} from "react-router-dom";
import {useState,useEffect} from "react";

function DriverDetails(){
    const {year,id}=useParams()
    const [driver,setDriver]=useState(null)
    const [standing,setStanding] = useState(null)
    
    useEffect(()=>{
        fetch(`http://localhost:3000/drivers/${year}`)
        .then((res)=>res.json())
        .then((data)=>{
            const selected = data.find((ele)=>ele.driverId===id)
            setDriver(selected)
        })
    },[year,id])
    useEffect(()=>{

        fetch(`http://localhost:3000/drivers/standings/${year}`)
        .then((res)=>res.json())
        .then((data)=>{

            const selectedStanding = data.find(
                (ele)=>ele.Driver.driverId === id
            );

            setStanding(selectedStanding);

        });

    },[year,id]);
        
    if (!driver || !standing) {
    return <h1>Loading...</h1>}
    const age = new Date().getFullYear() - new Date(driver.dateOfBirth).getFullYear();
    return(
        <div className="page">
            <h1> {driver.givenName} {driver.familyName}</h1>
            <p>Code: {driver.code}</p>
            <p>Nationality: {driver.nationality}</p>
            <p>Date of Birth: {driver.dateOfBirth}</p>
            <p>Age: {age}</p>
            <p>Driver ID: {driver.driverId}</p>
            <p>Number: {driver.permanentNumber}</p>
            <p>Championship Position: {standing.position}</p>

            <p>Points: {standing.points}</p>

            <p>Wins: {standing.wins}</p>

            <p>
                Current Team:
                {" "}
                {standing.Constructors[0].name}
            </p>
            <p>URL: <a href={driver.url} target="_blank">{driver.familyName}'s Wikipedia Profile</a></p>

        </div>
    )
}
export default DriverDetails;
