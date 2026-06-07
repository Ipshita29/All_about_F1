import { useState, useEffect } from "react";

function LandingPage() {
    const [race,setRace]=useState(null)
    const [user,setUser]=useState(null)
    useEffect(()=>{
        fetch("http://localhost:3000/grandprixdashboard/2026")
        .then((res)=>res.json())
        .then((data)=>{
            const today = new Date();
            const nextRace = data.find((race)=>{
                return new Date(race.date) > today
            })
            setRace(nextRace)
        })
    },[])
    useEffect(()=>{
        const token = localStorage.getItem("token");
        if(!token){
            return
        }
        fetch("http://localhost:3000/user/profile",
                    {headers:{Authorization: token}}
                )
                .then((res)=>res.json())
                .then((data)=>setUser(data));

        },[])

    if (!race) {
    return <h1>Loading...</h1>}
    return (
        <div className="page">
            {user && (
            <div className="card">
                <h2>Welcome back {user.name}</h2>
                <p>Favorite Team: {user.favoriteTeam}</p>
                <p>Favorite Driver: {user.favoriteDriver}</p>
            </div>
            )}
            <h1>All About Formula One</h1>
            <p>Explore Formula One Drivers, Teams, Circuits, Grand Prix schedules and race information.</p>

            <hr />
            <h2>Upcoming Grand Prix</h2>
            <h3>{race.raceName}</h3>
            <p>Country: {race.Circuit.Location.country}</p>
            <p>Circuit: {race.Circuit.circuitName}</p>
            <p>Date: {race.date}</p>
            <hr />

            <h2>What You Can Explore</h2>
            <ul>
                <li>Drivers and their career statistics</li>
                <li>Formula One teams and history</li>
                <li>Circuit information and maps</li>
                <li>Grand Prix schedules from 2020-2026</li>
            </ul>
            <hr />
        </div>
    )
}

export default LandingPage;