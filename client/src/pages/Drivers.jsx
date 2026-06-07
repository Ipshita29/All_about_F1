import {useState,useEffect} from "react";
import {Link} from "react-router-dom"
function Drivers(){
    const [drivers,setDrivers]=useState([])
    const [search,setSearch]= useState("")
    const [year, setYear] = useState("2026")
    useEffect(()=>{
        fetch(`http://localhost:3000/drivers/${year}`)
        .then((res)=>res.json())
        .then((data)=>{setDrivers(data)})
    },[year])
    return(
        <div className="page">
            <h1>Drivers</h1>
             <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
            >
                <option value="2020">2020</option>
                <option value="2021">2021</option>
                <option value="2022">2022</option>
                <option value="2023">2023</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
            </select>
            <p>Total Drivers: {drivers.length}</p>
            <Link to="/compare-drivers">
                <button>
                    Compare Drivers
                </button>
            </Link>
            <div>
            <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e)=>setSearch(e.target.value)}/>
            {drivers
            .filter((ele)=>`${ele.givenName} ${ele.familyName}`.toLowerCase().includes(search.toLowerCase()))
            .map((ele,index)=>{
                return <Link to={`/drivers/${year}/${ele.driverId}`} key={index}>
                    <div className="card">
                    <h3>{ele.givenName} {ele.familyName}</h3>
                    <p>Number: {ele.permanentNumber}</p>
                    <p>Nationality: {ele.nationality}</p>
                </div>
                </Link>
            })}
            </div>
        </div>
    )
}
export default Drivers;