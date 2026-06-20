import { useState,useEffect } from "react";

function Preferences() {

    const [favoriteTeam, setFavoriteTeam] = useState("");
    const [favoriteDriver,setFavoriteDriver] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
            const token = localStorage.getItem("token");

            fetch("http://localhost:3000/user/profile", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
            .then((res) => res.json())
            .then((data) => {
                setFavoriteTeam(data.favoriteTeam || "");
                setFavoriteDriver(data.favoriteDriver || "");
            });

        }, [])
    const savePreference = async () => {
        const token = localStorage.getItem("token");
        const response = await fetch("http://localhost:3000/user/preferences",
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({favoriteTeam,favoriteDriver})
            }
        )
        const data = await response.json();
        console.log(data);
        setMessage("Preferences Saved Successfully");
        setTimeout(() => { window.location.href = "/"; }, 800);

    }

    return (
        <div className="page">

            <h1>Favorite Team</h1>
            <select
                value={favoriteTeam}
                onChange={(e)=>setFavoriteTeam(e.target.value)}>

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
            <p>
                Favorite Team:
                {favoriteTeam || " Not Selected"}
            </p>

            <br /><br />

            <h1>Favorite Driver</h1>
            <select
                value={favoriteDriver}
                onChange={(e)=>setFavoriteDriver(e.target.value)}
            >

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
            <p>
                Favorite Driver:
                {favoriteDriver || " Not Selected"}
            </p>

            <br /><br />
            {message && (
                <p className="success-message">
                    {message}
                </p>
            )}
            <button
                onClick={savePreference}
                disabled={!favoriteTeam || !favoriteDriver}
            >
                Save Preference
            </button>
            <div className="info-card">

                <h3>How Personalization Works</h3>

                <p>
                    Save your favorite team and driver
                    to receive a personalized Formula 1
                    experience across all your devices.
                </p>

                <ul>
                    <li>Personalized Team News</li>
                    <li>Driver Updates</li>
                    <li>Future Race Notifications</li>
                    <li>Customized Homepage Feed</li>
                </ul>

            </div>

        </div>
    );
}

export default Preferences;