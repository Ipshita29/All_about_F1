import {useState,useEffect} from "react";
function Profile(){
    const [user,setUser] = useState(null);
    useEffect(()=>{
        const token = localStorage.getItem("token")
        fetch("http://localhost:3000/user/profile",{
            headers:{Authorization:token}
        })
        .then((res)=>res.json())
        .then((data)=>setUser(data))

    },[])
    if(!user){
        return(<h1>Loading...</h1>)
    }
    return(<div className="page">
            <div className="card">
                <h1>Profile</h1>
                <p>Name: {user.name}</p>
                <p>Email: {user.email}</p>
                <p>Favorite Team: {user.favoriteTeam}</p>
                <p>Favorite Driver: {user.favoriteDriver}</p>
            </div>
            </div>)
}
export default Profile;