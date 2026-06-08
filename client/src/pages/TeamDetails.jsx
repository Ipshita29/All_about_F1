import {useParams} from "react-router-dom";
import {useState,useEffect} from "react";

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
        return (<p>Loading...</p>)
    }
    return(
        <div className="page">
            <h1>{team.name}</h1>
            <p>Nationality: {team.nationality}</p>
            <p>URL:<a href={team.url} target="_blank">{team.name}'s Wikipedia Profile</a></p>
            <p>Championship Position:{" "}{standing.position}</p>
            <p>Points:{" "}{standing.points}</p>
            <p>Wins:{" "}{standing.wins}</p>
        </div>)
}
export default TeamDetails;
