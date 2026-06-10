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
            <div className="page-controls">
                <input
                    type="text"
                    placeholder="Search circuit..."
                    value={search}
                    onChange={(e)=>setSearch(e.target.value)}/>
            </div>
            <div className="list-grid">
                {circuit
                .filter((ele)=>`${ele.circuitId}`.toLowerCase().includes(search.toLowerCase()))
                .map((ele,index)=>(
                    <Link to={`/circuitmaps/${ele.circuitId}`} key={index} className="list-card">
                        <h3>{ele.circuitName}</h3>
                        <p>{ele.Location.country}</p>
                    </Link>
                ))}
            </div>
        </div>
    )
}
export default CircuitMaps;
