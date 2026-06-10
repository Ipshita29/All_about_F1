import {useParams} from "react-router-dom";
import {useState,useEffect} from "react";
import teamInfo from "../data/teamInfo";

function TeamDetails(){
    const {year,id}=useParams()
    const [team,setTeam] = useState(null)
    const [standing,setStanding] = useState(null);
    useEffect(()=>{
        fetch(`http://localhost:3000/teams/${year}`)
        .then((res)=>res.json())
        .then((data)=>{
            const selected = data.find((ele)=>ele.constructorId===id)
            setTeam(selected)
        })
    },[year,id])
    useEffect(()=>{
        fetch(`http://localhost:3000/teams/standings/${year}`)
        .then((res)=>res.json())
        .then((data)=>{
            const selectedStanding = data.find(
                (ele)=>ele.Constructor.constructorId===id
            );
            setStanding(selectedStanding);
        })
    },[year,id]);
    if(!team || !standing){
        return (<div className="loading">Loading...</div>)
    }

    const extraInfo = teamInfo[team.constructorId];
    return(
        <div className="page detail-page">
            <h1>{team.name}</h1>
            <p><a href={team.url} target="_blank">{team.name}'s Wikipedia Profile</a></p>

            <h2>History</h2>
            <p>{extraInfo?.history}</p>

            <h2>Team Info</h2>
            <p>Nationality: {team.nationality}</p>
            <p>Founded: {extraInfo?.founded}</p>
            <p>Headquarters: {extraInfo?.headquarters}</p>
            <p>Team Principal: {extraInfo?.teamPrincipal}</p>
            <p>Engine Supplier: {extraInfo?.engineSupplier}</p>

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

            <h2>Championships</h2>
            <p>Total Championships: {extraInfo?.championships}</p>

            <h2>Achievements</h2>
            <ul>{extraInfo?.achievements?.map((achievement,index)=>(
                <li key={index}>{achievement}</li>
            ))}</ul>

            <h2>Famous Drivers</h2>
            <ul>{extraInfo?.famousDrivers?.map((driver,index)=>(
                <li key={index}>{driver}</li>
            ))}</ul>

            <h2>Strategy Style</h2>
            <p>{extraInfo?.strategyStyle}</p>

            <h2>Strengths</h2>
            <ul>{extraInfo?.strengths?.map((strength,index)=>(
                <li key={index}>{strength}</li>
            ))}</ul>

            <h2>Weaknesses</h2>
            <ul>{extraInfo?.weaknesses?.map((weakness,index)=>(
                <li key={index}>{weakness}</li>
            ))}</ul>

            <h2>Fun Facts</h2>
            <ul>{extraInfo?.funFacts?.map((fact,index)=>(
                <li key={index}>{fact}</li>
            ))}</ul>

            <h2>Social Links</h2>
            <p>Instagram: {extraInfo?.socials?.instagram}</p>
            <p>Twitter: {extraInfo?.socials?.twitter}</p>
            <a href={extraInfo?.socials?.website} target="_blank" rel="noreferrer">
                Official Website
            </a>

            <h2>Team Colors</h2>
            <div className="team-colors">
                <div className="color-box" style={{backgroundColor: extraInfo?.teamColors?.primary}}></div>
                <div className="color-box" style={{backgroundColor: extraInfo?.teamColors?.secondary}}></div>
                <div className="color-box" style={{backgroundColor: extraInfo?.teamColors?.accent}}></div>
            </div>
        </div>
    )
}
export default TeamDetails;
