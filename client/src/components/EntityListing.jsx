import { Link } from "react-router-dom";
import { LayeredImage } from "./EntityDetail";
import { getDriverAssets } from "../config/driverAssets";
import { getTeamAssets } from "../config/teamAssets";

/*
 * The Drivers/Constructors listing pages' building blocks: the season +
 * search + count control strip, the two roster grids, the driver and
 * constructor cards, and the small "current line-up" driver list reused
 * inside the constructor card and Team Comparison.
 */

/* Shared control strip for the Drivers and Constructors index pages —
   season, search and a count, laid out as one editorial line with
   underlines instead of boxed form controls. */
export function SearchControls({
    year,
    years,
    onYearChange,
    search,
    onSearchChange,
    searchPlaceholder,
    count,
    onLight = false,
    children,
}) {
    return (
        <div className={`sc${onLight ? " sc--on-light" : ""}`}>
            {years && (
                <label className="sc-field sc-field--year">
                    <span className="sc-label">SEASON</span>
                    <select value={year} onChange={(e) => onYearChange(e.target.value)}>
                        {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </label>
            )}

            <label className="sc-field sc-field--search">
                <span className="sc-label">{searchPlaceholder}</span>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Type to filter…"
                />
            </label>

            <span className="sc-count">{count}</span>

            {children}
        </div>
    );
}

export function DriverRoster({ children }) {
    return (
        <ol className="dp-grid" aria-label="Driver roster">
            {children}
        </ol>
    );
}

export function ConstructorRoster({ children }) {
    return (
        <ol className="cc-grid" aria-label="Constructor roster">
            {children}
        </ol>
    );
}

/* The two drivers currently seated for a constructor, by number — an
   explicit link back into the Drivers roster. */
export function TeamDrivers({ drivers, year }) {
    if (!drivers?.length) return <span className="td-empty">—</span>;
    return (
        <div className="td">
            {drivers.map((d) => (
                <Link
                    key={d.Driver.driverId}
                    to={`/drivers/${year}/${d.Driver.driverId}`}
                    className="td-item"
                >
                    <span className="td-num">{d.Driver.permanentNumber ?? "—"}</span>
                    <span className="td-name">{d.Driver.familyName}</span>
                </Link>
            ))}
        </div>
    );
}

/* One driver as a premium grid card: number + position up top, a large
   consistently-cropped portrait cutout (or, when no real cutout exists
   for that driver, a bold ghost number in its place — never a random
   low-quality photo), then name / team / points. Nationality and a
   "View Profile" cue reveal on hover; the card is already complete
   without it. */
export function DriverCard({ standing, year }) {
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

/* One constructor as a data composition, not a car photo — no local or
   remote car image is reliable/consistent enough to use (see
   config/teamAssets.js), so the card leans on the team's real logo plus
   typography: position, name, points and the current driver pairing.
   A "stretched link" pattern (.cc-hit) makes the whole card clickable
   while the two driver links inside stay independently clickable. */
export function ConstructorCard({ team, standing, drivers, year, leaderPts }) {
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
