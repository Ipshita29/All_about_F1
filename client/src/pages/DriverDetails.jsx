import {useParams} from "react-router-dom";
import {useState,useEffect} from "react";
import driverInfo from "../data/driverInfo";

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
    const extraInfo = driverInfo[`${driver.givenName} ${driver.familyName}`];
    return(
        <div className="page">
            <h1>{driver.givenName} {driver.familyName}</h1>
            {extraInfo?.nickname && <p>"{extraInfo.nickname}"</p>}
            <p>URL: <a href={driver.url} target="_blank">{driver.familyName}'s Wikipedia Profile</a></p>

            <h2>About</h2>
            <p>{extraInfo?.description}</p>

            <h2>Driver Info</h2>
            <p>Code: {driver.code}</p>
            <p>Number: {driver.permanentNumber}</p>
            <p>Nationality: {driver.nationality}</p>
            <p>Date of Birth: {driver.dateOfBirth}</p>
            <p>Age: {age}</p>
            <p>Debut: {extraInfo?.debut}</p>

            <h2>{year} Season</h2>
            <p>Championship Position: {standing.position}</p>
            <p>Points: {standing.points}</p>
            <p>Wins: {standing.wins}</p>
            <p>Current Team: {standing.Constructors[0].name}</p>

            <h2>Career Stats</h2>
            <p>World Championships: {extraInfo?.championships}</p>
            <p>Race Wins: {extraInfo?.raceWins}</p>
            <p>Podiums: {extraInfo?.podiums}</p>
            <p>Pole Positions: {extraInfo?.polePositions}</p>
            <p>Best Season: {extraInfo?.bestSeason}</p>

            <h2>Driving Style</h2>
            <p>{extraInfo?.drivingStyle}</p>

            <h2>Career Highlights</h2>
            <ul>{extraInfo?.careerHighlights?.map((highlight,index)=>(
                <li key={index}>{highlight}</li>
            ))}</ul>

            <h2>Famous Races</h2>
            <ul>{extraInfo?.famousRaces?.map((race,index)=>(
                <li key={index}>{race}</li>
            ))}</ul>

            <h2>Fun Facts</h2>
            <ul>{extraInfo?.funFacts?.map((fact,index)=>(
                <li key={index}>{fact}</li>
            ))}</ul>

            {extraInfo?.quote && (
                <>
                <h2>In Their Own Words</h2>
                <p>"{extraInfo.quote}"</p>
                </>
            )}
        </div>
    )
}
export default DriverDetails;
