import {useParams} from "react-router-dom";
import {useState,useEffect} from "react";

function TeamDetails(){
    const {id} = useParams()
    const [team,setTeam] = useState(null)
    useEffect(()=>{
        fetch("http://localhost:3000/teams")
        .then((res)=>res.json())
        .then((data)=>{
            const selected = data.find((ele)=>ele.constructorId===id)
            setTeam(selected)
        })
    },[id])
    if(!team){
        return (<p>Loading...</p>)
    }

    return(
        <div className="page">
            <h1>{team.name}</h1>
            <p>Nationality: {team.nationality}</p>
            <p>URL:<a href={team.url} target="_blank">{team.name}'s Wikipedia Profile</a></p>
        </div>)
}

export default TeamDetails;
