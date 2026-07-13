import LayeredImage from "./LayeredImage";
import { getDriverAssets, getTeamAccent } from "../../config/driverAssets";

/*
 * Driver Pass — a paddock-credential-style card for one driver standing.
 * Layered composition: carbon weave base, engineering rules, a huge faded
 * racing number, the transparent driver cutout, and credential typography.
 * `isCenter` marks the focused pass in THE GRID carousel; that pass carries
 * the view-transition names shared with the Driver Details hero so the card
 * unfolds into the dossier page.
 */
function DriverPass({ standing, isCenter = false }) {
    const d = standing.Driver;
    const team = standing.Constructors?.[0];
    const fullName = `${d.givenName} ${d.familyName}`;
    const assets = getDriverAssets(d.driverId, fullName);
    const accent = getTeamAccent(team?.constructorId);
    const number = d.permanentNumber ?? "—";

    return (
        <article
            className={`ex-pass${isCenter ? " is-center" : ""}`}
            style={{ "--accent": accent }}
        >
            <div className="ex-pass-inner">
                <header className="ex-pass-top">
                    <span className="ex-pass-code">{d.code || d.familyName.slice(0, 3).toUpperCase()}</span>
                    <span className="ex-pass-cred">FIA · PADDOCK PASS</span>
                    <span className="ex-pass-pos">P{standing.position}</span>
                </header>

                <div className="ex-pass-visual">
                    <span
                        className="ex-pass-num"
                        aria-hidden="true"
                        style={isCenter ? { viewTransitionName: "driver-number" } : undefined}
                    >
                        {number}
                    </span>
                    <div
                        className="ex-pass-img-wrap"
                        style={isCenter ? { viewTransitionName: "driver-portrait" } : undefined}
                    >
                        <LayeredImage
                            candidates={assets.imageCandidates}
                            alt={fullName}
                            className="ex-pass-img"
                            style={{ objectPosition: assets.objectPosition }}
                            fallback={
                                <div className="ex-entity-fallback" aria-hidden="true">
                                    <span>{d.givenName[0]}{d.familyName[0]}</span>
                                </div>
                            }
                        />
                    </div>
                </div>

                <footer className="ex-pass-id">
                    <span className="ex-pass-given">{d.givenName}</span>
                    <span className="ex-pass-family">{d.familyName}</span>
                    <div className="ex-pass-meta">
                        <span>{team?.name ?? "—"}</span>
                        <span className="ex-pass-meta-dot" aria-hidden="true" />
                        <span>{d.nationality}</span>
                    </div>
                </footer>

                {/* telemetry strip — revealed on hover of the centered pass */}
                <div className="ex-pass-telemetry" aria-hidden={!isCenter}>
                    <div className="ex-pass-tele-item">
                        <span className="ex-pass-tele-val">{standing.points}</span>
                        <span className="ex-pass-tele-label">PTS</span>
                    </div>
                    <div className="ex-pass-tele-item">
                        <span className="ex-pass-tele-val">{standing.wins}</span>
                        <span className="ex-pass-tele-label">WINS</span>
                    </div>
                    <div className="ex-pass-tele-item">
                        <span className="ex-pass-tele-val">{assets.info?.championships ?? 0}</span>
                        <span className="ex-pass-tele-label">TITLES</span>
                    </div>
                </div>

                <span className="ex-pass-accent" aria-hidden="true" />
            </div>
        </article>
    );
}

export default DriverPass;
