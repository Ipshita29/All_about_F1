import {Link} from "react-router-dom";
function Navbar(){
    const token = localStorage.getItem("token");
    const handleLogout=()=>{
        localStorage.removeItem("token")
        alert("Logged out successfully")
        window.location.href="/login"
    }
    return(
        <nav>
            <Link to="/">Home</Link>
            <Link to="/grandprixdashboard">Grand Prix Dashboard</Link>
            <Link to="/drivers">Driver</Link>
            <Link to="/teams">Teams</Link>
            <Link to="/circuitmaps">Circuit Maps</Link>
            <Link to="/preferences"> Preferences</Link>
            <Link to="/profile">Profile</Link>
            {token ? (
                <button onClick={handleLogout}>
                    Logout
                </button>
            ) : (
                <>
                    <Link to="/login">Login</Link>
                    <Link to="/signup">Signup</Link>
                </>
            )}
        </nav>
    )
}
export default Navbar;