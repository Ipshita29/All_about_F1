import {useState,useEffect} from "react";
import { Link } from "react-router-dom";
function GrandPrix(){
    const [grandprix,setGrandprix]=useState([])
    const [year, setYear] = useState("2026")
    const [search,setSearch]= useState("")
    useEffect(()=>{
        fetch(`http://localhost:3000/grandprixdashboard/${year}`)
        .then((res)=>res.json())
        .then((data)=>{setGrandprix(data)})
    },[year])
    return(
        <div className="page">
            <h1>Grand Prix Schedule</h1>
            <div className="page-controls">
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                    <option value="2020">2020</option>
                    <option value="2021">2021</option>
                    <option value="2022">2022</option>
                    <option value="2023">2023</option>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                </select>
                <input
                    type="text"
                    placeholder="Search grand prix..."
                    value={search}
                    onChange={(e)=>setSearch(e.target.value)}/>
            </div>
            <div className="list-grid">
                {[...grandprix]
                .reverse()
                .filter((ele)=>`${ele.raceName} ${ele.Circuit.Location.country}`.toLowerCase().includes(search.toLowerCase()))
                .map((ele,index)=>(
                    <Link to={`/grandprixdashboard/${year}/${ele.round}`} key={index} className="list-card">
                        <h3>{ele.raceName}</h3>
                        <p>{ele.Circuit.circuitName}</p>
                        <p>{ele.Circuit.Location.country}</p>
                        <p className="list-date">{ele.date}</p>
                    </Link>
                ))}
            </div>
        </div>
    )
}
export default GrandPrix;
