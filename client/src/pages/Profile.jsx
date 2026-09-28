/*
 * PROFILE — name, email, favourite driver, favourite team. Nothing else:
 * no gamification, no learning telemetry, no shortcuts. Same /user/profile
 * GET/PUT endpoints and auth/session handling as before; only the page
 * itself is new, built from the shared Input/Select/Button components.
 */
import { useState, useEffect } from "react";
import { Button, Input, LoadingSpinner, Select } from "../components/UI";
import { DRIVER_ID_MAP } from "../utils/landingHelpers";
import "../styles/pages/Profile.css";
import { API_BASE_URL as API } from "../config/api";

const DRIVERS = Object.keys(DRIVER_ID_MAP).filter((name) => name !== "Andrea Kimi Antonelli");

const TEAMS = [
    ["Ferrari", "Scuderia Ferrari HP"],
    ["Mercedes", "Mercedes-AMG PETRONAS F1 Team"],
    ["Red Bull", "Oracle Red Bull Racing"],
    ["McLaren", "McLaren Formula 1 Team"],
    ["Aston Martin", "Aston Martin Aramco Formula One Team"],
    ["Alpine", "BWT Alpine Formula One Team"],
    ["Haas", "MoneyGram Haas F1 Team"],
    ["Racing Bulls", "Visa Cash App Racing Bulls F1 Team"],
    ["Williams", "Atlassian Williams Racing"],
    ["Sauber", "Stake F1 Team Kick Sauber"],
    ["Cadillac", "Cadillac Formula 1 Team"],
];

function Profile() {
    const [user, setUser] = useState(null);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [favoriteDriver, setFavoriteDriver] = useState("");
    const [favoriteTeam, setFavoriteTeam] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;
        fetch(`${API}/user/profile`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.json())
            .then((data) => {
                setUser(data);
                setName(data.name || "");
                setEmail(data.email || "");
                setFavoriteDriver(data.favoriteDriver || "");
                setFavoriteTeam(data.favoriteTeam || "");
            });
    }, []);

    if (!user) return <div className="pf pf-loading"><LoadingSpinner /></div>;

    const handleSave = async (e) => {
        e.preventDefault();
        setError("");
        setSaved(false);
        setSaving(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/user/profile`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name, email, favoriteDriver, favoriteTeam }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Could not save. Try again.");
            setUser(data);
            setSaved(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        window.location.href = "/auth";
    };

    return (
        <div className="pf">
            <header className="pf-header">
                <span className="pf-eyebrow">ACCOUNT</span>
                <h1 className="pf-title">Profile</h1>
            </header>

            <main className="pf-main">
                <form className="pf-form" onSubmit={handleSave}>
                    <Input
                        label="NAME"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <Input
                        label="EMAIL"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <Select
                        label="FAVOURITE DRIVER"
                        value={favoriteDriver}
                        onChange={(e) => setFavoriteDriver(e.target.value)}
                    >
                        <option value="">Select driver</option>
                        {DRIVERS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </Select>
                    <Select
                        label="FAVOURITE TEAM"
                        value={favoriteTeam}
                        onChange={(e) => setFavoriteTeam(e.target.value)}
                    >
                        <option value="">Select team</option>
                        {TEAMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>

                    {error && <p className="pf-message pf-message--error">{error}</p>}
                    {saved && !error && <p className="pf-message pf-message--success">Profile updated.</p>}

                    <div className="pf-actions">
                        <Button type="submit" variant="primary" disabled={saving}>
                            {saving ? "Saving…" : "Save Changes"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={handleLogout}>
                            Log Out
                        </Button>
                    </div>
                </form>
            </main>
        </div>
    );
}

export default Profile;
