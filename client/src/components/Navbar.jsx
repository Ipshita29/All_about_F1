import {Link} from "react-router-dom";
function Navbar(){
    return(
        <nav>
            <Link to="/">Home</Link>
            <Link to="/grandprixdashboard">Grand Prix Dashboard</Link>
            <Link to="/drivers">Driver</Link>
            <Link to="/teams">Teams</Link>
            <Link to="/circuitmaps">Circuit Maps</Link>
            <Link to="/login">Login</Link>
            <Link to="/signup">Signup</Link>
            <Link to="/preferences"> Preferences</Link>
        </nav>
    )
}
export default Navbar;