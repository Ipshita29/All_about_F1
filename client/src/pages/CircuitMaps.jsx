import {useState,useEffect} from "react";
function CircuitMaps(){
    const [circuit,setCircuit]=useState([])
    useEffect(()=>{
        fetch("http://localhost:3000/circuitmaps")
        .then((res)=>res.json())
        .then((data)=>{setCircuit(data)})
    },[])
    return(
        <div>
            <h1>Circuit Maps</h1>
            {circuit.map((ele,index)=>{
                return <div key={index}>
                    <h3>{ele.circuitName}</h3>
                    <p>{ele.Location.country}</p>
                </div>
            })}
        </div>
    )
}
export default CircuitMaps;