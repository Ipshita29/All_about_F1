import {useState,useEffect} from "react";
import {Link} from "react-router-dom"
function Drivers(){
    const [drivers,setDrivers]=useState([])
    const [search,setSearch]= useState("")
    const [year, setYear] = useState("2026")

    {/*to filter out test/reserver driver,we only want f1 driver*/}
    const mainDrivers = drivers.filter(
        driver =>
            driver.permanentNumber &&
            driver.code &&
            driver.nationality
        )
        
    useEffect(()=>{
        fetch(`http://localhost:3000/drivers/${year}`)
        .then((res)=>res.json())
        .then((data)=>{setDrivers(data)})
    },[year])
    return(
        <div className="page">
            <h1>Drivers</h1>
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
                    placeholder="Search by name..."
                    value={search}
                    onChange={(e)=>setSearch(e.target.value)}/>
                <p>{mainDrivers.length} drivers</p>
                <Link to="/compare-drivers">
                    <button>Compare Drivers</button>
                </Link>
            </div>
            <div className="list-grid">
                {mainDrivers
                .filter((ele)=>`${ele.givenName} ${ele.familyName}`.toLowerCase().includes(search.toLowerCase()))
                .map((ele,index)=>(
                    <Link to={`/drivers/${year}/${ele.driverId}`} key={index} className="list-card">
                        <h3>{ele.givenName} {ele.familyName}</h3>
                        <p>#{ele.permanentNumber} · {ele.nationality}</p>
                    </Link>
                ))}
            </div>
        </div>
    )
}
export default Drivers;
