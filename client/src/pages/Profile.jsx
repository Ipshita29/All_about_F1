import {useState,useEffect} from "react";
function Profile(){
    const [user,setUser] = useState(null);
    useEffect(() => {
    const token = localStorage.getItem("token");

    console.log("TOKEN:", token);

    if (!token) return;

    fetch("http://localhost:3000/user/profile", {
        headers: {
        Authorization: `Bearer ${token}`,
        },
    })
        .then((res) => {
        console.log("STATUS:", res.status);
        return res.json();
        })
        .then((data) => {
        console.log("PROFILE DATA:", data);
        setUser(data);
        });
    }, []);
    if(!user){
        return(<div className="loading">Loading...</div>)
    }
    return(
        <div className="page">
            <div className="profile-card">
                <h1>Profile</h1>
                <div className="profile-row">
                    <span className="profile-label">Name</span>
                    <span className="profile-value">{user.name}</span>
                </div>
                <div className="profile-row">
                    <span className="profile-label">Email</span>
                    <span className="profile-value">{user.email}</span>
                </div>
                <div className="profile-row">
                    <span className="profile-label">Favorite Team</span>
                    <span className="profile-value">{user.favoriteTeam}</span>
                </div>
                <div className="profile-row">
                    <span className="profile-label">Favorite Driver</span>
                    <span className="profile-value">{user.favoriteDriver}</span>
                </div>
            </div>
        </div>
    )
}
export default Profile;
