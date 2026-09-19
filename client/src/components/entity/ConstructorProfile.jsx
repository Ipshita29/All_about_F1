import { Link } from "react-router-dom";
import TeamDrivers from "./TeamDrivers";
import ChampionshipProgress from "./ChampionshipProgress";

/*
 * One constructor as a championship dossier row. The team as a whole is
 * clickable (a full-row "stretched" link) while each driver underneath
 * stays independently clickable — see .cp-hit in EntityPages.css for how
 * the two links coexist without nesting an <a> inside an <a>.
 */
export default function ConstructorProfile({ team, standing, drivers, year, accent, leaderPts }) {
    return (
        <li className="cp-item" style={{ "--accent": accent }}>
            <Link
                to={`/teams/${year}/${team.constructorId}`}
                viewTransition
                className="cp-hit"
                aria-label={`${team.name} — team details`}
            />

            <span className="cp-pos">
                {standing ? String(standing.position).padStart(2, "0") : "—"}
            </span>

            <div className="cp-main">
                <h3 className="cp-name">{team.name}</h3>
                <span className="cp-nat">{team.nationality}</span>
                <TeamDrivers drivers={drivers} year={year} />
            </div>

            <div className="cp-stats">
                <div className="cp-stat">
                    <b>{standing?.points ?? "—"}</b>
                    <small>PTS</small>
                </div>
                <div className="cp-stat">
                    <b>{standing?.wins ?? "—"}</b>
                    <small>WINS</small>
                </div>
                <ChampionshipProgress value={standing?.points} max={leaderPts} />
            </div>

            <span className="cp-arrow" aria-hidden="true">→</span>
        </li>
    );
}
