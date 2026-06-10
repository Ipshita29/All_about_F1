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
        return <div className="loading">Loading...</div>
    }
    const age = new Date().getFullYear() - new Date(driver.dateOfBirth).getFullYear();
    const extraInfo = driverInfo[`${driver.givenName} ${driver.familyName}`];
    return(
        <div className="page detail-page">
            <h1>{driver.givenName} {driver.familyName}</h1>
            {extraInfo?.nickname && <p>"{extraInfo.nickname}"</p>}
            <p><a href={driver.url} target="_blank">{driver.familyName}'s Wikipedia Profile</a></p>

            <h2>About</h2>
            <p>{extraInfo?.description}</p>

            <h2>Driver Info</h2>
            <p>Code: {driver.code}</p>
            <p>Number: #{driver.permanentNumber}</p>
            <p>Nationality: {driver.nationality}</p>
            <p>Date of Birth: {driver.dateOfBirth}</p>
            <p>Age: {age}</p>
            <p>Debut: {extraInfo?.debut}</p>

            <h2>{year} Season</h2>
            <div className="stat-row">
                <div className="stat-box">
                    <span className="stat-value">{standing.position}</span>
                    <span className="stat-label">Position</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{standing.points}</span>
                    <span className="stat-label">Points</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{standing.wins}</span>
                    <span className="stat-label">Wins</span>
                </div>
            </div>
            <p>Current Team: {standing.Constructors[0].name}</p>

            <h2>Career Stats</h2>
            <div className="stat-row">
                <div className="stat-box">
                    <span className="stat-value">{extraInfo?.championships ?? '—'}</span>
                    <span className="stat-label">Championships</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{extraInfo?.raceWins ?? '—'}</span>
                    <span className="stat-label">Race Wins</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{extraInfo?.podiums ?? '—'}</span>
                    <span className="stat-label">Podiums</span>
                </div>
            </div>
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
