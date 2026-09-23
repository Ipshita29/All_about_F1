import { Link } from "react-router-dom";
import TeamDrivers from "./TeamDrivers";
import { getTeamAssets } from "../../config/teamAssets";

/*
 * One constructor as a data composition, not a car photo — no local or
 * remote car image is reliable/consistent enough to use (see
 * config/teamAssets.js), so the card leans on the team's real logo
 * (small, consistent, already in the repo) plus typography: position,
 * name, points and the current driver pairing. A "stretched link"
 * pattern (.cc-hit) makes the whole card clickable while the two driver
 * links inside stay independently clickable — see EntityPages.css.
 */
export default function ConstructorCard({ team, standing, drivers, year, leaderPts }) {
    const assets = getTeamAssets(team.constructorId);
    const share = leaderPts > 0 && standing ? Math.max(0.03, standing.points / leaderPts) : 0;

    return (
        <li className="cc-card">
            <Link
                to={`/teams/${year}/${team.constructorId}`}
                viewTransition
                className="cc-hit"
                aria-label={`${team.name} — team details`}
            />

            <div className="cc-top">
                <span className="cc-pos rw-mono">{standing ? `P${standing.position}` : "—"}</span>
                {assets.logo && (
                    <img src={assets.logo} alt="" aria-hidden="true" className="cc-logo" />
                )}
            </div>

            <h3 className="cc-name">{team.name}</h3>
            <p className="cc-nat">{team.nationality}</p>

            <div className="cc-pts">
                <b className="rw-mono">{standing?.points ?? "—"}</b>
                <span>POINTS</span>
            </div>

            <span className="cc-bar" aria-hidden="true"><span style={{ width: `${share * 100}%` }} /></span>

            <div className="cc-drivers">
                <span className="cc-drivers-label rw-mono">CURRENT LINE-UP</span>
                <TeamDrivers drivers={drivers} year={year} />
            </div>

            <span className="cc-go rw-mono">VIEW TEAM <i aria-hidden="true">→</i></span>
        </li>
    );
}
