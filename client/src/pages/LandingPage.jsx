import { useState, useEffect } from "react";

function LandingPage() {
    const [race, setRace] = useState(null);
    const [user, setUser] = useState(null);

    useEffect(() => {
        fetch("http://localhost:3000/grandprixdashboard/2026")
            .then((res) => res.json())
            .then((data) => {
                const today = new Date();
                const nextRace = data.find((race) => new Date(race.date) > today);
                setRace(nextRace);
            });
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        fetch("http://localhost:3000/user/profile", { headers: { Authorization: token } })
            .then((res) => res.json())
            .then((data) => setUser(data));
    }, []);

    const features = [
        { title: "Drivers", desc: "Career stats and driver profiles" },
        { title: "Teams", desc: "Constructor history and standings" },
        { title: "Circuits", desc: "Track maps from around the world" },
        { title: "Grand Prix", desc: "Race schedules from 2020 to 2026" },
    ];

    if (!race) return <div className="loading">Loading...</div>;

    return (
        <div className="page landing-page">
            <div className="landing-hero">
                <h1>All About <span className="hero-accent">Formula One</span></h1>
                <p className="hero-sub">Your ultimate F1 hub — drivers, teams, circuits, and race history</p>
            </div>

            {user && (
                <div className="welcome-banner">
                    <h2>Welcome back, {user.name}</h2>
                    <div className="welcome-details">
                        <span className="detail-chip">Team: {user.favoriteTeam}</span>
                        <span className="detail-chip">Driver: {user.favoriteDriver}</span>
                    </div>
                </div>
            )}

            <section className="landing-section">
                <h2 className="section-label">Upcoming Grand Prix</h2>
                <div className="race-card">
                    <div className="race-card-flag"></div>
                    <div className="race-card-body">
                        <div className="race-name">{race.raceName}</div>
                        <div className="race-meta">
                            <span>
                                <strong>Country</strong>
                                {race.Circuit.Location.country}
                            </span>
                            <span>
                                <strong>Circuit</strong>
                                {race.Circuit.circuitName}
                            </span>
                            <span>
                                <strong>Date</strong>
                                {new Date(race.date).toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="landing-section">
                <h2 className="section-label">Explore</h2>
                <div className="explore-grid">
                    {features.map((item, i) => (
                        <div className="feature-card" key={i}>
                            <span className="feature-number">0{i + 1}</span>
                            <h3>{item.title}</h3>
                            <p>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

export default LandingPage;
