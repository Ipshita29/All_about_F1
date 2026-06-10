import { useState } from "react";

function Preferences() {

    const [favoriteTeam, setFavoriteTeam] = useState("");
    const [favoriteDriver,setFavoriteDriver] = useState("");
    const savePreference = async () => {
        const token = localStorage.getItem("token");
        const response = await fetch("http://localhost:3000/user/preferences",
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token
                },
                body: JSON.stringify({favoriteTeam,favoriteDriver})
            }
        )
        const data = await response.json();
        console.log(data);
        alert("Preference Saved");

    }

    return (
        <div className="page">

            <h1>Favorite Team</h1>
            <select
                value={favoriteTeam}
                onChange={(e)=>setFavoriteTeam(e.target.value)}
            >

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

            <br /><br />

            <button onClick={savePreference}>
                Save Preference
            </button>

        </div>
    );
}

export default Preferences;