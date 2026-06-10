import {useState,useEffect} from "react";
import {Link} from "react-router-dom";
function Teams(){
    const [teams,setTeams]=useState([])
    const [search,setSearch]= useState("")
    const [year, setYear] = useState("2026")
    useEffect(()=>{
        fetch(`http://localhost:3000/teams/${year}`)
        .then((res)=>res.json())
        .then((data)=>{setTeams(data)})
    },[year])
    return(
        <div className="page">
            <h1>Teams</h1>
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
                    placeholder="Search team..."
                    value={search}
                    onChange={(e)=>setSearch(e.target.value)}/>
            </div>
            <div className="list-grid">
                {teams
                .filter((ele)=>`${ele.name}`.toLowerCase().includes(search.toLowerCase()))
                .map((ele,index)=>(
                    <Link to={`/teams/${year}/${ele.constructorId}`} key={index} className="list-card">
                        <h3>{ele.name}</h3>
                        <p>{ele.nationality}</p>
                    </Link>
                ))}
            </div>
        </div>
    )
}
export default Teams;
