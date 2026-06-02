import {useState,useEffect} from "react";
import {Link} from "react-router-dom"
function Drivers(){
    const [drivers,setDrivers]=useState([])
    const [search,setSearch]= useState("")
    useEffect(()=>{
        fetch("http://localhost:3000/drivers")
        .then((res)=>res.json())
        .then((data)=>{setDrivers(data)})
    },[])
    return(
        <div className="page">
            <h1>Drivers</h1>
            <input
            type="text"
            placeholder="Search Driver"
            value={search}
            onChange={(e)=>setSearch(e.target.value)}/>
            {drivers
            .filter((ele)=>`${ele.givenName} ${ele.familyName}`.toLowerCase().includes(search.toLowerCase()))
            .map((ele,index)=>{
                return <Link to={`/drivers/${ele.driverId}`} key={index}>
                    <h3>{ele.givenName} {ele.familyName}</h3>
                </Link>
            })}
        </div>
    )
}
export default Drivers;