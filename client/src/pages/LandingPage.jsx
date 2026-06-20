import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

function LandingPage() {
    const [race, setRace] = useState(null);
    const [user, setUser] = useState(null);
    const [driverStandings, setDriverStandings] = useState([]);
    const [constructorStandings, setConstructorStandings] = useState([]);
    const [latestRace, setLatestRace] = useState(null);

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
        fetch("http://localhost:3000/user/profile", { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.json())
            .then((data) => setUser(data));
    }, []);

    useEffect(()=>{
        fetch(
            "http://localhost:3000/drivers/standings/2026"
        )
            .then((res) => res.json())
            .then((data) => setDriverStandings(data));
    },[])

    useEffect(()=>{
        fetch(
            "http://localhost:3000/teams/standings/2026"
        )
            .then((res) => res.json())
            .then((data) => setConstructorStandings(data));
    },[])
    useEffect(() => {
        fetch(
            "http://localhost:3000/grandprixdashboard/latest"
        )
            .then((res) => res.json())
            .then((data) => setLatestRace(data));
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
    }
    const features = [
        { title: "Drivers", desc: "Career stats and driver profiles" },
        { title: "Teams", desc: "Constructor history and standings" },
        { title: "Circuits", desc: "Track maps from around the world" },
        { title: "Grand Prix", desc: "Race schedules from 2020 to 2026" },
    ]

    if (!race) return <div className="loading">Loading...</div>;
    const raceDate = new Date(race.date);
    const today = new Date();
    const daysRemaining = Math.ceil((raceDate - today) /(1000 * 60 * 60 * 24));

    return (
        <div className="page landing-page">
            <div className="landing-hero">
                <h1>All About <span className="hero-accent">Formula One</span></h1>
                <p className="hero-sub">Your ultimate F1 hub — drivers, teams, circuits, and race history</p>
            </div>
            {user?.favoriteTeam && user?.favoriteDriver &&(
                <div className="welcome-banner">
                    <h2>Welcome back, {user.name}</h2>
                    <div className="welcome-details">
                        <Link to={`/teams/2026/${user.favoriteTeam.toLowerCase().replace(" ", "_")}`} className="detail-chip">Team: {user.favoriteTeam}</Link>
                        <Link to={`/drivers/2026/${driverIdMap[user.favoriteDriver] ?? user.favoriteDriver.toLowerCase().replaceAll(" ", "_")}`} className="detail-chip">Driver: {user.favoriteDriver}</Link>
                    </div>
                </div>
            )}
            <img src="../images/ferrari.png" alt="Formula 1" className="hero-image"/>
            <section className="landing-section">
                <h2 className="section-label">Live Race Center</h2>
                <div className="live-race-card">
                    <div className="live-header">
                        <span className="live-dot"></span>
                        <span>LIVE RACE CENTER</span>
                    </div>
                    <h3>No Active Session</h3>
                    <p>There is currently no Formula 1 session in progress.</p>
                    <div className="live-placeholder-grid">
                        <div className="live-stat">
                            <span className="live-label">Current Lap</span>
                            <span className="live-value"> --</span>
                        </div>
                        <div className="live-stat">
                            <span className="live-label">Leader</span>
                            <span className="live-value"> -- </span>
                        </div>
                        <div className="live-stat">
                            <span className="live-label">Fastest Lap</span>
                            <span className="live-value"> -- </span>
                        </div>
                    </div>
                    <button> View Grand Prix Dashboard </button>
                </div>
            </section>
            {latestRace && latestRace.Results?.length >= 3 && (
                <section className="landing-section">
                    <h2 className="section-label">Latest Race Result</h2>
                    <div className="race-summary-card">
                        <div className="race-summary-header">
                            <h3>{latestRace.raceName}</h3>
                            <span>Round {latestRace.round} &middot; {latestRace.season}</span>
                        </div>
                        <div className="podium-grid">
                            {[
                                { medal: '🥇', cls: 'podium-first', r: latestRace.Results[0] },
                                { medal: '🥈', cls: 'podium-second', r: latestRace.Results[1] },
                                { medal: '🥉', cls: 'podium-third', r: latestRace.Results[2] },
                            ].map(({ medal, cls, r }) => (
                                <div key={r.Driver.driverId} className={`podium-card ${cls}`}>
                                    <span className="podium-medal">{medal}</span>
                                    <span className="podium-name">
                                        {r.Driver.givenName} {r.Driver.familyName}
                                    </span>
                                    <span className="podium-team">{r.Constructor.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}
            <section className="landing-section">
                <div className="standings-columns">
                    <div>
                        <h2 className="section-label">Driver Championship</h2>
                        {driverStandings.slice(0, 3).map((driver) => (
                            <div key={driver.Driver.driverId} className={`standing-card rank-${driver.position}`}>
                                <span className="standing-pos">{driver.position}</span>
                                <div className="standing-info">
                                    <span className="standing-name">
                                        {driver.Driver.givenName} {driver.Driver.familyName}
                                    </span>
                                </div>
                                <span className="standing-pts">{driver.points}<small> PTS</small></span>
                            </div>
                        ))}
                    </div>
                    <div>
                        <h2 className="section-label">Constructor Championship</h2>
                        {constructorStandings.slice(0, 3).map((team) => (
                            <div key={team.Constructor.constructorId} className={`standing-card rank-${team.position}`}>
                                <span className="standing-pos">{team.position}</span>
                                <div className="standing-info">
                                    <span className="standing-name">{team.Constructor.name}</span>
                                </div>
                                <span className="standing-pts">{team.points}<small> PTS</small></span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            <section className="landing-section">
                <h2 className="section-label">Upcoming Grand Prix</h2>
                <div className="race-card">
                    <div className="race-card-flag"></div>
                    <div className="race-card-body">
                        <p className="countdown">{daysRemaining} Days Remaining</p>
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
