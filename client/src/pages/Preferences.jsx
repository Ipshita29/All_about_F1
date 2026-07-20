/*
 * TUNE YOUR SETUP — preferences as a garage tuning console.
 * Same endpoints, option values, validation and post-save redirect as
 * before; restyled to live inside the My Garage experience (.mg).
 */
import { useState, useEffect } from "react";
import "./MyGarage.css";

const API = "http://localhost:3000";

function Preferences() {
    const [favoriteTeam, setFavoriteTeam] = useState("");
    const [favoriteDriver, setFavoriteDriver] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");
        fetch(`${API}/user/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then((res) => res.json())
        .then((data) => {
            setFavoriteTeam(data.favoriteTeam || "");
            setFavoriteDriver(data.favoriteDriver || "");
        });
    }, []);

    const savePreference = async () => {
        const token = localStorage.getItem("token");
        await fetch(`${API}/user/preferences`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ favoriteTeam, favoriteDriver })
        });
        setMessage("Setup saved. Rolling out of the garage…");
        setTimeout(() => { window.location.href = "/"; }, 800);
    };

    return (
        <div className="mg mg--lit">
            <header className="mg-hero mg-hero--compact">
                <div className="mg-hero-lights" aria-hidden="true">
                    <span /><span /><span />
                </div>
                <span className="mg-hero-eyebrow mg-mono">MY GARAGE · SETUP SHEET</span>
                <h1 className="mg-hero-title">TUNE YOUR SETUP</h1>
                <p className="mg-hero-sub mg-mono">
                    PICK YOUR COLOURS — THE WHOLE SITE ADAPTS AROUND THEM
                </p>
            </header>

            <main className="mg-main">
                <div className="mg-tune">
                    <section className="mg-module mg-module--tune" aria-label="Preferences">
                        <span className="mg-module-label mg-mono">SETUP SHEET</span>

                        <label className="mg-tune-field">
                            <span className="mg-tune-label mg-mono">FAVOURITE CONSTRUCTOR</span>
                            <select value={favoriteTeam} onChange={(e) => setFavoriteTeam(e.target.value)}>
                                <option value="">Select Team</option>
                                <option value="Ferrari">Scuderia Ferrari HP</option>
                                <option value="Mercedes">Mercedes-AMG PETRONAS F1 Team</option>
                                <option value="Red Bull">Oracle Red Bull Racing</option>
                                <option value="McLaren">McLaren Formula 1 Team</option>
                                <option value="Aston Martin">Aston Martin Aramco Formula One Team</option>
                                <option value="Alpine">BWT Alpine Formula One Team</option>
                                <option value="Haas">MoneyGram Haas F1 Team</option>
                                <option value="Racing Bulls">Visa Cash App Racing Bulls F1 Team</option>
                                <option value="Williams">Atlassian Williams Racing</option>
                                <option value="Sauber">Stake F1 Team Kick Sauber</option>
                                <option value="Cadillac">Cadillac Formula 1 Team</option>
                            </select>
                        </label>

                        <label className="mg-tune-field">
                            <span className="mg-tune-label mg-mono">FAVOURITE DRIVER</span>
                            <select value={favoriteDriver} onChange={(e) => setFavoriteDriver(e.target.value)}>
                                <option value="">Select Driver</option>
                                <option value="Charles Leclerc">Charles Leclerc</option>
                                <option value="Lewis Hamilton">Lewis Hamilton</option>
                                <option value="George Russell">George Russell</option>
                                <option value="Kimi Antonelli">Kimi Antonelli</option>
                                <option value="Max Verstappen">Max Verstappen</option>
                                <option value="Yuki Tsunoda">Yuki Tsunoda</option>
                                <option value="Lando Norris">Lando Norris</option>
                                <option value="Oscar Piastri">Oscar Piastri</option>
                                <option value="Fernando Alonso">Fernando Alonso</option>
                                <option value="Lance Stroll">Lance Stroll</option>
                                <option value="Pierre Gasly">Pierre Gasly</option>
                                <option value="Franco Colapinto">Franco Colapinto</option>
                                <option value="Esteban Ocon">Esteban Ocon</option>
                                <option value="Oliver Bearman">Oliver Bearman</option>
                                <option value="Liam Lawson">Liam Lawson</option>
                                <option value="Isack Hadjar">Isack Hadjar</option>
                                <option value="Carlos Sainz">Carlos Sainz</option>
                                <option value="Alexander Albon">Alexander Albon</option>
                                <option value="Nico Hulkenberg">Nico Hulkenberg</option>
                                <option value="Gabriel Bortoleto">Gabriel Bortoleto</option>
                            </select>
                        </label>

                        {message && <p className="mg-tune-message mg-mono">{message.toUpperCase()}</p>}

                        <button
                            className="mg-save-btn"
                            onClick={savePreference}
                            disabled={!favoriteTeam || !favoriteDriver}
                        >
                            LOCK IN SETUP
                        </button>
                    </section>

                    <aside className="mg-module mg-module--why" aria-label="How personalization works">
                        <span className="mg-module-label mg-mono">WHY IT MATTERS</span>
                        <p className="mg-why-text">
                            Save your favourite team and driver to receive a personalized
                            Formula 1 experience across all your devices.
                        </p>
                        <ul className="mg-why-list">
                            <li>Personalized Team News</li>
                            <li>Driver Updates</li>
                            <li>Future Race Notifications</li>
                            <li>Customized Homepage Feed</li>
                        </ul>
                    </aside>
                </div>
            </main>
        </div>
    );
}

export default Preferences;
