import { Link } from "react-router-dom";

/*
 * One driver as an editorial profile block, not a table row. The racing
 * number carries most of the visual weight (huge, muted); the team is
 * reduced to a hairline accent that brightens on hover.
 */
export default function DriverProfileRow({ standing, year, accent }) {
    const d = standing.Driver;
    const team = standing.Constructors?.[0];

    return (
        <li>
            <Link
                to={`/drivers/${year}/${d.driverId}`}
                viewTransition
                className="dp-item"
                style={{ "--accent": accent }}
            >
                <div className="dp-top">
                    <span className="dp-pos">{String(standing.position).padStart(2, "0")}</span>
                    <span className="dp-pts"><b>{standing.points}</b><small>PTS</small></span>
                </div>

                <div className="dp-identity">
                    <span
                        className="dp-num"
                        aria-hidden="true"
                        style={{ viewTransitionName: "driver-number" }}
                    >
                        {d.permanentNumber ?? "—"}
                    </span>
                    <div className="dp-name">
                        <span className="dp-given">{d.givenName}</span>
                        <span className="dp-family">{d.familyName}</span>
                    </div>
                </div>

                <span className="dp-nat">{d.nationality}</span>

                <div className="dp-bottom">
                    <span className="dp-team">
                        <i className="dp-swatch" aria-hidden="true" />
                        {team?.name ?? "—"}
                    </span>
                    <span className="dp-wins"><b>{standing.wins}</b><small>WINS</small></span>
                    <span className="dp-arrow" aria-hidden="true">→</span>
                </div>
            </Link>
        </li>
    );
}
