import { useState, useEffect } from "react";

function LandingPage() {
    const [race,setRace]=useState(null)
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

    if (!race) {
    return <h1>Loading...</h1>}
    return (
        <div className="page">
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