import { Link } from "react-router-dom";
import LayeredImage from "./LayeredImage";
import { getDriverAssets } from "../../config/driverAssets";

/*
 * One driver as a premium grid card: number + position up top, a large
 * consistently-cropped portrait cutout (or, when no real cutout exists
 * for that driver, a bold ghost number in its place — never a random
 * low-quality photo), then name / team / points. Nationality and a
 * "View Profile" cue reveal on hover; the card is already complete
 * without it.
 */
export default function DriverCard({ standing, year }) {
    const d = standing.Driver;
    const team = standing.Constructors?.[0];
    const fullName = `${d.givenName} ${d.familyName}`;
    const assets = getDriverAssets(d.driverId, fullName);
    const number = d.permanentNumber ?? "—";

    return (
        <li>
            <Link to={`/drivers/${year}/${d.driverId}`} viewTransition className="dc-card">
                <div className="dc-top">
                    <span className="dc-num rw-mono" style={{ viewTransitionName: "driver-number" }}>
                        {number}
                    </span>
                    <span className="dc-pos rw-mono">P{standing.position}</span>
                </div>

                <div className="dc-media" style={{ viewTransitionName: "driver-portrait" }}>
                    <LayeredImage
                        candidates={assets.imageCandidates}
                        alt={fullName}
                        className="dc-img"
                        style={{ objectPosition: assets.objectPosition }}
                        fallback={<span className="dc-ghost rw-mono" aria-hidden="true">{number}</span>}
                    />
                </div>

                <div className="dc-body">
                    <h3 className="dc-name">
                        <span className="dc-given">{d.givenName}</span>
                        <b className="dc-family">{d.familyName}</b>
                    </h3>
                    <p className="dc-team">{team?.name ?? "—"}</p>

                    <div className="dc-row">
                        <span className="dc-pts"><b>{standing.points}</b> PTS</span>
                        <span className="dc-reveal">
                            <span className="dc-nat">{d.nationality}</span>
                            <span className="dc-view">VIEW PROFILE <i aria-hidden="true">→</i></span>
                        </span>
                    </div>
                </div>
            </Link>
        </li>
    );
}
