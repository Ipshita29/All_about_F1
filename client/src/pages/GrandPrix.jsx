import {useState,useEffect} from "react";
function GrandPrix(){
    const [grandprix,setGrandprix]=useState([])
    useEffect(()=>{
        fetch("http://localhost:3000/grandprixdashboard")
        .then((res)=>res.json())
        .then((data)=>{setGrandprix(data)})
    },[])
    return(
        <div>
            <h1>Grand Prix Schedule</h1>
            {grandprix.map((ele,index)=>{
                return <div key={index}>
                    <h3>{ele.raceName}</h3>
                    <p>{ele.Circuit.ciruitName}</p>
                    <p>{ele.date}</p>
                    <p>{ele.Circuit.Location.country}</p>
                </div>
            })}
        </div>
    )
}
export default GrandPrix;