import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";

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

const teamIdMap = {
    "Ferrari": "ferrari",
    "Red Bull": "red_bull",
    "McLaren": "mclaren",
    "Mercedes": "mercedes",
    "Aston Martin": "aston_martin",
    "Alpine": "alpine",
    "Williams": "williams",
    "RB": "rb",
    "Haas": "haas",
    "Sauber": "sauber",
    "Kick Sauber": "sauber",
};

function Profile() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        fetch("http://localhost:3000/user/profile", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => setUser(data));
    }, []);

    if (!user) return <div className="loading"><LoadingSpinner /></div>;

    const initials = user.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";

    const driverId =
        driverIdMap[user.favoriteDriver] ||
        user.favoriteDriver?.toLowerCase().replaceAll(" ", "_");

    const teamId =
        teamIdMap[user.favoriteTeam] ||
        user.favoriteTeam?.toLowerCase().replaceAll(" ", "_");

    return (
        <div className="page">
            <div className="profile-avatar">{initials}</div>

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
                    <span className="profile-label">Favourite Team</span>
                    <span className="profile-value">{user.favoriteTeam || "—"}</span>
                </div>
                <div className="profile-row">
                    <span className="profile-label">Favourite Driver</span>
                    <span className="profile-value">{user.favoriteDriver || "—"}</span>
                </div>
            </div>

            {(user.favoriteTeam || user.favoriteDriver) && (
                <div className="profile-picks">
                    <h2 className="section-label">Your Picks</h2>
                    <div className="stat-row">
                        {user.favoriteTeam && (
                            <div className="stat-box">
                                <span className="stat-value" style={{ fontSize: "1.1rem", lineHeight: 1.3 }}>
                                    {user.favoriteTeam}
                                </span>
                                <span className="stat-label">Favourite Team</span>
                                <Link
                                    to={`/teams/2026/${teamId}`}
                                    style={{ marginTop: 10, fontSize: "0.75rem", color: "#E10600", fontWeight: 700 }}
                                >
                                    View Team →
                                </Link>
                            </div>
                        )}
                        {user.favoriteDriver && (
                            <div className="stat-box">
                                <span className="stat-value" style={{ fontSize: "1.1rem", lineHeight: 1.3 }}>
                                    {user.favoriteDriver}
                                </span>
                                <span className="stat-label">Favourite Driver</span>
                                <Link
                                    to={`/drivers/2026/${driverId}`}
                                    style={{ marginTop: 10, fontSize: "0.75rem", color: "#E10600", fontWeight: 700 }}
                                >
                                    View Driver →
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Profile;
