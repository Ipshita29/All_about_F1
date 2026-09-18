/*
 * One row-list, shared by the Drivers and Constructors views of the
 * homepage championship section. A thin proportional line under each row
 * shows the points gap to the leader at a glance — no chart library needed.
 */
import {
    getTeamColor,
    isFavouriteDriver,
    isFavouriteTeam,
    pointsToLeader,
} from "../../utils/landingHelpers";

export default function ChampionshipTable({ variant, standings, leaderPts, favs }) {
    const isDrivers = variant === "drivers";

    return (
        <ol className="lp-champ-list">
            {standings.map((s) => {
                const driver = isDrivers ? s.Driver : null;
                const constructor = isDrivers ? s.Constructors?.[0] : s.Constructor;
                const fav = isDrivers
                    ? isFavouriteDriver(favs, driver) || isFavouriteTeam(favs, constructor)
                    : isFavouriteTeam(favs, constructor);
                const color = getTeamColor(constructor?.constructorId);
                const share = leaderPts > 0 ? Math.max(0.03, s.points / leaderPts) : 0;

                return (
                    <li
                        key={isDrivers ? driver.driverId : constructor.constructorId}
                        className={`lp-champ-row${isDrivers ? "" : " lp-champ-row--team"}${fav ? " lp-champ-row--fav" : ""}`}
                        style={fav && favs.teamColor ? { "--fav-color": favs.teamColor } : undefined}
                    >
                        {isDrivers && (
                            <span className="lp-champ-ghostnum lp-mono" aria-hidden="true">
                                {driver.permanentNumber || s.position}
                            </span>
                        )}
                        <span className="lp-champ-pos lp-mono">{s.position}</span>
                        <span
                            className="lp-champ-strip"
                            style={color ? { background: color } : undefined}
                            aria-hidden="true"
                        />
                        <div className="lp-champ-main">
                            <span className="lp-champ-name">
                                {isDrivers ? (
                                    <>{driver.givenName} <b>{driver.familyName?.toUpperCase()}</b></>
                                ) : (
                                    <b>{constructor.name?.toUpperCase()}</b>
                                )}
                                {fav && <span className="lp-champ-favtag">FAV</span>}
                            </span>
                            <span className="lp-champ-bar" aria-hidden="true">
                                <span style={{ width: `${share * 100}%`, background: color || undefined }} />
                            </span>
                        </div>
                        {isDrivers && <span className="lp-champ-team">{constructor?.name}</span>}
                        <span className="lp-champ-gap lp-mono">{pointsToLeader(s.points, leaderPts)}</span>
                        <span className="lp-champ-pts lp-mono">
                            {s.points}
                            <small> PTS</small>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
