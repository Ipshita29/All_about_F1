import {useState,useEffect} from "react";
function Drivers(){
    const [drivers,setDrivers]=useState([])
    useEffect(()=>{
        fetch("http://localhost:3000/drivers")
        .then((res)=>res.json())
        .then((data)=>{setDrivers(data)})
    },[])
    return(
        <div>
            <h1>Drivers</h1>
            {drivers.map((ele,index)=>{
                return <div key={index}>
                    <h3>{ele.givenName} {ele.familyName}</h3>
                    <p>{ele.nationality}</p>
                </div>
            })}
        </div>
    )
}
export default Drivers;