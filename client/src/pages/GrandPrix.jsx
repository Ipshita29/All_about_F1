import {useState,useEffect} from "react";
import { Link } from "react-router-dom";
function GrandPrix(){
    const [grandprix,setGrandprix]=useState([])
    const [search,setSearch]= useState("")
    useEffect(()=>{
        fetch("http://localhost:3000/grandprixdashboard")
        .then((res)=>res.json())
        .then((data)=>{setGrandprix(data)})
    },[])
    return(
        <div>
            <h1>Grand Prix Schedule</h1>
            <input
            type="text"
            placeholder="Search Driver"
            value={search}
            onChange={(e)=>setSearch(e.target.value)}/>
            {[...grandprix]
            .reverse()
            .filter((ele)=>`${ele.raceName} ${ele.Circuit.Location.country}`.toLowerCase().includes(search.toLowerCase()))
            .map((ele,index)=>{
                return <Link to={`/grandprixdashboard/${ele.round}`} key={index}>
                    <h3>{ele.raceName}</h3>
                    <p>{ele.Circuit.circuitName}</p>
                    <p>{ele.date}</p>
                    <p>{ele.Circuit.Location.country}</p>
                </Link>
            })}
        </div>
    )
}
export default GrandPrix;