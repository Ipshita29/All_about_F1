import {useState,useEffect} from "react";
import {Link} from "react-router-dom";
function Teams(){
    const [teams,setTeams]=useState([])
    const [search,setSearch]= useState("")
    useEffect(()=>{
        fetch("http://localhost:3000/teams")
        .then((res)=>res.json())
        .then((data)=>{setTeams(data)})
    },[])
    return(
        <div>
            <h1>Teams</h1>
            <input
            type="text"
            placeholder="Search Team"
            value={search}
            onChange={(e)=>setSearch(e.target.value)}/>
            {teams
            .filter((ele)=>`${ele.name}`.toLowerCase().includes(search.toLowerCase()))
            .map((ele,index)=>{
                return <Link to={`/teams/${ele.constructorId}`} key={index}>
                    <h3>{ele.name}</h3>
                    <p>{ele.nationality}</p>
                </Link>
            })}
        </div>
    )
}
export default Teams;