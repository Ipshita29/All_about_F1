import {useState,useEffect} from "react";
function Teams(){
    const [teams,setTeams]=useState([])
    useEffect(()=>{
        fetch("http://localhost:3000/teams")
        .then((res)=>res.json())
        .then((data)=>{setTeams(data)})
    },[])
    return(
        <div>
            <h1>Teams</h1>
            {teams.map((ele,index)=>{
                return <div key={index}>
                    <h3>{ele.name}</h3>
                    <p>{ele.nationality}</p>
                </div>
            })}
        </div>
    )
}
export default Teams;