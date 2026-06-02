import {useState,useEffect} from "react";
import { Link } from "react-router-dom";
function CircuitMaps(){
    const [circuit,setCircuit]=useState([])
    const [search,setSearch]= useState("")
    useEffect(()=>{
        fetch("http://localhost:3000/circuitmaps")
        .then((res)=>res.json())
        .then((data)=>{setCircuit(data)})
    },[])
    return(
        <div className="page">
            <h1>Circuit Maps</h1>
            <input
            type="text"
            placeholder="Search Circuit"
            value={search}
            onChange={(e)=>setSearch(e.target.value)}/>
            {circuit
            .filter((ele)=>`${ele.circuitId}`.toLowerCase().includes(search.toLowerCase()))
            .map((ele,index)=>{
                return <Link to={`/circuitmaps/${ele.circuitId}`} key={index}>
                    <h3>{ele.circuitName}</h3>
                    <p>{ele.Location.country}</p>
                </Link>
            })}
        </div>
    )
}
export default CircuitMaps;