import { useState } from "react";

function Preferences() {

    const [favoriteTeam, setFavoriteTeam] = useState("");

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
                    favoriteTeam
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

            <button onClick={savePreference}>
                Save Preference
            </button>

        </div>
    );
}

export default Preferences;