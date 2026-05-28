import {Link} from "react-router-dom";
function Navbar(){
    return(
        <nav>
            <Link to="/grandprixdashboard">Grand Prix Dashboard</Link>
            <Link to="/drivers">Driver</Link>
            <Link to="/teams">Teams</Link>
            <Link to="/circuitmaps">Circuit Maps</Link>
        </nav>
    )
}
export default Navbar;