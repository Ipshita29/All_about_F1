import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

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

    const driverIdMap = {
        "Charles Leclerc": "leclerc",
        "Lewis Hamilton": "hamilton",
        "George Russell": "russell",
        "Kimi Antonelli": "antonelli",
        "Max Verstappen": "max_verstappen",
        "Yuki Tsunoda": "tsunoda",
        "Lando Norris": "norris",
        "Oscar Piastri": "piastri",
        "Fernando Alonso": "alonso",
        "Lance Stroll": "stroll",
        "Pierre Gasly": "gasly",
        "Franco Colapinto": "colapinto",
        "Esteban Ocon": "ocon",
        "Oliver Bearman": "bearman",
        "Liam Lawson": "lawson",
        "Isack Hadjar": "hadjar",
        "Carlos Sainz": "sainz",
        "Alexander Albon": "albon",
        "Nico Hulkenberg": "hulkenberg",
        "Gabriel Bortoleto": "bortoleto",
    };

    const features = [
        { title: "Drivers", desc: "Career stats and driver profiles" },
        { title: "Teams", desc: "Constructor history and standings" },
        { title: "Circuits", desc: "Track maps from around the world" },
        { title: "Grand Prix", desc: "Race schedules from 2020 to 2026" },
    ];


    if (!race) return <div className="loading">Loading...</div>;
    const raceDate = new Date(race.date);
    const today = new Date();

    const daysRemaining = Math.ceil(
        (raceDate - today) /
        (1000 * 60 * 60 * 24)
    );

    return (
        <div className="page landing-page">
            <div className="landing-hero">
                <h1>All About <span className="hero-accent">Formula One</span></h1>
                <p className="hero-sub">Your ultimate F1 hub — drivers, teams, circuits, and race history</p>
            </div>
            <section className="landing-section">
                <h2 className="section-label">
                    Live Race Center
                </h2>

                <div className="live-race-card">

                    <div className="live-header">
                        <span className="live-dot"></span>
                        <span>LIVE RACE CENTER</span>
                    </div>

                    <h3>No Active Session</h3>

                    <p>
                        There is currently no Formula 1 session in progress.
                    </p>

                    <div className="live-placeholder-grid">

                        <div className="live-stat">
                            <span className="live-label">
                                Current Lap
                            </span>
                            <span className="live-value">
                                --
                            </span>
                        </div>

                        <div className="live-stat">
                            <span className="live-label">
                                Leader
                            </span>
                            <span className="live-value">
                                --
                            </span>
                        </div>

                        <div className="live-stat">
                            <span className="live-label">
                                Fastest Lap
                            </span>
                            <span className="live-value">
                                --
                            </span>
                        </div>

                    </div>

                    <button>
                        View Grand Prix Dashboard
                    </button>

                </div>
            </section>

            {user && (
                <div>
                <div className="welcome-banner">
                    <h2>Welcome back, {user.name}</h2>
                    <div className="welcome-details">
                        <span className="detail-chip">Team: {user.favoriteTeam}</span>
                        <span className="detail-chip">Driver: {user.favoriteDriver}</span>
                    </div>
                </div>
                <section className="landing-section">
                        <h2 className="section-label">
                            Your Favorites
                        </h2>

                        <div className="explore-grid">

                            <Link
                                to={`/teams/2026/${user.favoriteTeam.toLowerCase().replace(" ", "_")}`}
                            >
                                <div className="feature-card">
                                    <h3>Favorite Team</h3>
                                    <p>{user.favoriteTeam}</p>
                                </div>
                            </Link>

                            <Link
                                to={`/drivers/2026/${driverIdMap[user.favoriteDriver] ?? user.favoriteDriver.toLowerCase().replaceAll(" ", "_")}`}
                            >
                                <div className="feature-card">
                                    <h3>Favorite Driver</h3>
                                    <p>{user.favoriteDriver}</p>
                                </div>
                            </Link>

                        </div>
                    </section>
                </div>
            )}
            

            <section className="landing-section">
                <h2 className="section-label">Upcoming Grand Prix</h2>
                <div className="race-card">
                    <div className="race-card-flag"></div>
                    <div className="race-card-body">
                        <p className="countdown">
                            {daysRemaining} Days Remaining
                        </p>
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
