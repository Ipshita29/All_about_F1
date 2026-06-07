import { useState } from "react";

function Preferences() {

    const [favoriteTeam, setFavoriteTeam] = useState("");
    const [favoriteDriver,setFavoriteDriver] = useState("");

    const savePreference = async () => {

        const token = localStorage.getItem("token");

        const response = await fetch(
            "http://localhost:3000/user/preferences",
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token
                },
                body: JSON.stringify({
                    favoriteTeam,
                    favoriteDriver
                })
            }
        );

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

                <option value="Ferrari">Ferrari</option>
                <option value="Mercedes">Mercedes</option>
                <option value="Red Bull">Red Bull</option>
                <option value="McLaren">McLaren</option>
                <option value="Aston Martin">Aston Martin</option>

            </select>

            <br /><br />

            <h1>Favorite Driver</h1>

            <select
                value={favoriteDriver}
                onChange={(e)=>setFavoriteDriver(e.target.value)}
            >

                <option value="">Select Driver</option>

                <option value="Max Verstappen">
                    Max Verstappen
                </option>

                <option value="Lewis Hamilton">
                    Lewis Hamilton
                </option>

                <option value="Charles Leclerc">
                    Charles Leclerc
                </option>

                <option value="Lando Norris">
                    Lando Norris
                </option>

                <option value="George Russell">
                    George Russell
                </option>

            </select>

            <br /><br />

            <button onClick={savePreference}>
                Save Preference
            </button>

        </div>
    );
}

export default Preferences;