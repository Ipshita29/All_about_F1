import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    Users, Wrench, Map, Flag,
    Trophy, Radio, ArrowRight, ChevronRight,
    Calendar, Globe
} from "lucide-react";

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
    { title: "Drivers",   desc: "Career stats and driver profiles",       path: "/drivers",           Icon: Users,  sub: "20 drivers" },
    { title: "Teams",     desc: "Constructor history and standings",       path: "/teams",             Icon: Wrench, sub: "10 constructors" },
    { title: "Circuits",  desc: "Track maps from around the world",        path: "/circuitmaps",       Icon: Map,    sub: "24 circuits" },
    { title: "Grand Prix",desc: "Race schedules from 2020 to 2026",        path: "/grandprixdashboard",Icon: Flag,   sub: "7 seasons" },
];

const podiumConfig = [
    { pos: "1", cls: "podium-first",  label: "P1" },
    { pos: "2", cls: "podium-second", label: "P2" },
    { pos: "3", cls: "podium-third",  label: "P3" },
];

function LandingPage() {
    const [race, setRace] = useState(null);
    const [user, setUser] = useState(null);
    const [driverStandings, setDriverStandings] = useState([]);
    const [constructorStandings, setConstructorStandings] = useState([]);
    const [latestRace, setLatestRace] = useState(null);
    const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("http://localhost:3000/grandprixdashboard/2026")
            .then((res) => res.json())
            .then((data) => {
                const today = new Date();
                const nextRace = data.find((r) => new Date(r.date) > today);
                setRace(nextRace);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        fetch("http://localhost:3000/user/profile", { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.json())
            .then((data) => setUser(data));
    }, []);

    useEffect(() => {
        fetch("http://localhost:3000/drivers/standings/2026")
            .then((res) => res.json())
            .then((data) => setDriverStandings(data));
    }, []);

    useEffect(() => {
        fetch("http://localhost:3000/teams/standings/2026")
            .then((res) => res.json())
            .then((data) => setConstructorStandings(data));
    }, []);

    useEffect(() => {
        fetch("http://localhost:3000/grandprixdashboard/latest")
            .then((res) => res.json())
            .then((data) => setLatestRace(data));
    }, []);

    useEffect(() => {
        if (!race) return;
        const target = new Date(race.date + "T00:00:00");
        const tick = () => {
            const diff = target - new Date();
            if (diff <= 0) return;
            setCountdown({
                days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((diff % (1000 * 60)) / 1000),
            });
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [race]);

    const maxDriverPts = Number(driverStandings[0]?.points) || 1;
    const maxTeamPts   = Number(constructorStandings[0]?.points) || 1;

    if (loading) {
        return (
            <div className="landing-loading">
                <div className="loading-spinner-ring"></div>
                <span>Loading F1 Data...</span>
            </div>
        );
    }

    const raceDate = race ? new Date(race.date + "T00:00:00") : null;

    return (
        <div className="page landing-page">

            {/* ── Hero ── */}
            <div className="landing-hero">
                <div className="hero-content">
                    <div className="hero-season-chip">2026 Season</div>
                    <h1>All About <span className="hero-accent">Formula One</span></h1>
                    <p className="hero-sub">Your ultimate F1 hub — drivers, teams, circuits, and race history from 2020 to 2026</p>
                    <div className="hero-cta">
                        <Link to="/grandprixdashboard" className="cta-btn cta-primary">View Schedule</Link>
                        <Link to="/drivers" className="cta-btn cta-secondary">Explore Drivers</Link>
                    </div>
                </div>
                <div className="hero-stats-bar">
                    {[
                        { val: "20", lbl: "Drivers" },
                        { val: "10", lbl: "Teams" },
                        { val: "24", lbl: "Races" },
                        { val: "7",  lbl: "Seasons" },
                    ].map((s, i, arr) => (
                        <div key={s.lbl} style={{ display: "flex", alignItems: "center", padding: 0 }}>
                            <div className="hero-stat-item">
                                <span className="hero-stat-val">{s.val}</span>
                                <span className="hero-stat-lbl">{s.lbl}</span>
                            </div>
                            {i < arr.length - 1 && <div className="hero-stat-divider"></div>}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Hero Image ── */}
            <div className="hero-image-wrapper">
                <img src="../images/ferrari.png" alt="Formula 1 Ferrari" className="hero-image" />
                <div className="hero-image-overlay">
                    <span className="hero-image-label">Ferrari SF-25</span>
                </div>
            </div>

            {/* ── Welcome Banner ── */}
            {user?.favoriteTeam && user?.favoriteDriver && (
                <div className="welcome-banner">
                    <div className="welcome-left">
                        <div className="welcome-greeting">Welcome back</div>
                        <h2>{user.name}</h2>
                    </div>
                    <div className="welcome-details">
                        <Link
                            to={`/teams/2026/${user.favoriteTeam.toLowerCase().replace(" ", "_")}`}
                            className="detail-chip"
                        >
                            <span className="chip-label">Team</span>
                            {user.favoriteTeam}
                        </Link>
                        <Link
                            to={`/drivers/2026/${driverIdMap[user.favoriteDriver] ?? user.favoriteDriver.toLowerCase().replaceAll(" ", "_")}`}
                            className="detail-chip"
                        >
                            <span className="chip-label">Driver</span>
                            {user.favoriteDriver}
                        </Link>
                    </div>
                </div>
            )}

            {/* ── Latest Race Result ── */}
            {latestRace && latestRace.Results?.length >= 3 && (
                <section className="landing-section">
                    <h2 className="section-label">Latest Race Result</h2>
                    <div className="race-summary-card">
                        <div className="race-summary-header">
                            <div style={{ padding: 0 }}>
                                <h3>{latestRace.raceName}</h3>
                                <span>Round {latestRace.round} · Season {latestRace.season}</span>
                            </div>
                            <Link to="/grandprixdashboard" className="summary-view-link">
                                Full Results <ChevronRight size={13} style={{ display: "inline", verticalAlign: "middle" }} />
                            </Link>
                        </div>
                        <div className="podium-grid">
                            {podiumConfig.map(({ pos, cls, label }, idx) => {
                                const r = latestRace.Results[idx];
                                return (
                                    <div key={r.Driver.driverId} className={`podium-card ${cls}`}>
                                        <div className="podium-trophy-row">
                                            <Trophy
                                                size={18}
                                                strokeWidth={1.8}
                                                className={`podium-trophy podium-trophy-${idx + 1}`}
                                            />
                                            <span className="podium-pos-label">{label}</span>
                                        </div>
                                        <span className="podium-pos">{pos}</span>
                                        <span className="podium-name">{r.Driver.givenName} {r.Driver.familyName}</span>
                                        <span className="podium-team">{r.Constructor.name}</span>
                                        {r.Time?.time && <span className="podium-time">{r.Time.time}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ── Next Race ── */}
            {race && (
                <section className="landing-section">
                    <h2 className="section-label">Next Race</h2>
                    <div className="next-race-card">
                        <div className="next-race-left">
                            <div className="next-race-icon-box">
                                <Flag size={32} strokeWidth={1.5} color="#E10600" />
                            </div>
                            <div className="next-race-info">
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, padding: 0 }}>
                                    <span className="gp-round">Round {race.round}</span>
                                    {race.Sprint && <span className="gp-badge gp-badge-sprint">Sprint Weekend</span>}
                                    <span className="gp-badge gp-badge-upcoming">Upcoming</span>
                                </div>
                                <div className="race-name">{race.raceName}</div>
                                <div className="race-meta">
                                    <span>
                                        <strong><Map size={10} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />Circuit</strong>
                                        {race.Circuit.circuitName}
                                    </span>
                                    <span>
                                        <strong><Globe size={10} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />Country</strong>
                                        {race.Circuit.Location.country}
                                    </span>
                                    <span>
                                        <strong><Calendar size={10} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />Date</strong>
                                        {raceDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                                    </span>
                                </div>
                                <Link to={`/grandprixdashboard/${race.season}/${race.round}`} className="next-race-link">
                                    View Full Schedule <ChevronRight size={13} style={{ display: "inline", verticalAlign: "middle" }} />
                                </Link>
                            </div>
                        </div>
                        <div className="countdown-block">
                            <div className="countdown-label">Race starts in</div>
                            <div className="countdown-grid">
                                {[
                                    { num: countdown.days,    lbl: "Days" },
                                    { num: countdown.hours,   lbl: "Hrs" },
                                    { num: countdown.minutes, lbl: "Min" },
                                    { num: countdown.seconds, lbl: "Sec" },
                                ].map((u, i, arr) => (
                                    <div key={u.lbl} style={{ display: "flex", alignItems: "flex-start", padding: 0 }}>
                                        <div className="countdown-unit">
                                            <span className="countdown-num">{String(u.num).padStart(2, "0")}</span>
                                            <span className="countdown-unit-lbl">{u.lbl}</span>
                                        </div>
                                        {i < arr.length - 1 && <span className="countdown-sep">:</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ── Championship Standings ── */}
            <section className="landing-section">
                <h2 className="section-label">2026 Championship Standings</h2>
                <div className="standings-columns">
                    <div>
                        <div className="standings-col-header">
                            <Users size={14} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
                            Driver Championship
                        </div>
                        {driverStandings.slice(0, 5).map((driver) => (
                            <div key={driver.Driver.driverId} className={`standing-card rank-${driver.position}`}>
                                <span className="standing-pos">{driver.position}</span>
                                <div className="standing-info">
                                    <span className="standing-name">
                                        {driver.Driver.givenName} {driver.Driver.familyName}
                                    </span>
                                    <div className="standing-bar">
                                        <div
                                            className="standing-bar-fill"
                                            style={{ width: `${(Number(driver.points) / maxDriverPts) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <span className="standing-pts">{driver.points}<small> PTS</small></span>
                            </div>
                        ))}
                        <Link to="/drivers" className="standings-more-link">
                            Full Driver Standings <ArrowRight size={12} style={{ display: "inline", verticalAlign: "middle" }} />
                        </Link>
                    </div>
                    <div>
                        <div className="standings-col-header">
                            <Wrench size={14} style={{ display: "inline", marginRight: 8, verticalAlign: "middle" }} />
                            Constructor Championship
                        </div>
                        {constructorStandings.slice(0, 5).map((team) => (
                            <div key={team.Constructor.constructorId} className={`standing-card rank-${team.position}`}>
                                <span className="standing-pos">{team.position}</span>
                                <div className="standing-info">
                                    <span className="standing-name">{team.Constructor.name}</span>
                                    <div className="standing-bar">
                                        <div
                                            className="standing-bar-fill"
                                            style={{ width: `${(Number(team.points) / maxTeamPts) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <span className="standing-pts">{team.points}<small> PTS</small></span>
                            </div>
                        ))}
                        <Link to="/teams" className="standings-more-link">
                            Full Constructor Standings <ArrowRight size={12} style={{ display: "inline", verticalAlign: "middle" }} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Live Race Center ── */}
            <section className="landing-section">
                <h2 className="section-label">Live Race Center</h2>
                <div className="live-race-card">
                    <div className="live-header">
                        <span className="live-dot"></span>
                        <Radio size={13} style={{ display: "inline", verticalAlign: "middle" }} />
                        <span>Live Timing</span>
                    </div>
                    <h3>No Active Session</h3>
                    <p>There is currently no Formula 1 session in progress.</p>
                    <div className="live-placeholder-grid">
                        <div className="live-stat">
                            <span className="live-label">Current Lap</span>
                            <span className="live-value">--</span>
                        </div>
                        <div className="live-stat">
                            <span className="live-label">Leader</span>
                            <span className="live-value">--</span>
                        </div>
                        <div className="live-stat">
                            <span className="live-label">Fastest Lap</span>
                            <span className="live-value">--</span>
                        </div>
                    </div>
                    <Link to="/grandprixdashboard" className="live-dashboard-btn">View Grand Prix Dashboard</Link>
                </div>
            </section>

            {/* ── Explore ── */}
            <section className="landing-section">
                <h2 className="section-label">Explore</h2>
                <div className="explore-grid">
                    {features.map(({ title, desc, path, Icon, sub }, i) => (
                        <Link to={path} className="feature-card" key={i}>
                            <div className="feature-icon-box">
                                <Icon size={22} strokeWidth={1.6} color="#E10600" />
                            </div>
                            <span className="feature-number">0{i + 1}</span>
                            <h3>{title}</h3>
                            <p>{desc}</p>
                            <div className="feature-footer">
                                <span className="feature-sub">{sub}</span>
                                <ArrowRight size={15} className="feature-arrow" />
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}

export default LandingPage;
