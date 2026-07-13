import LayeredImage from "./LayeredImage";
import { getTeamAssets } from "../../config/teamAssets";

/*
 * Garage Card — one bay of PIT LANE. The constructor's car waits behind a
 * partially-closed shutter door; hovering (or focusing) the card winches
 * the door up to reveal the car under restrained team lighting. The bay
 * number plate, drivers and constructor telemetry frame the entrance.
 * Each bay's interior carries a per-team view-transition name shared with
 * the Team Details hero, so clicking continues the door animation into
 * "walking inside the garage".
 */
function GarageCard({ team, standing, drivers = [] }) {
    const assets = getTeamAssets(team.constructorId);
    const info = assets.info;

    return (
        <article className="ex-garage" style={{ "--accent": assets.accent }}>
            <div className="ex-garage-bay">
                {/* interior: car + ambient team light */}
                <div
                    className="ex-garage-interior"
                    style={{ viewTransitionName: `team-car-${team.constructorId}` }}
                >
                    <span className="ex-garage-glow" aria-hidden="true" />
                    <LayeredImage
                        candidates={assets.carCandidates}
                        alt={`${team.name} Formula 1 car`}
                        className="ex-garage-car"
                        style={{ objectPosition: assets.objectPosition }}
                        fallback={
                            <div className="ex-garage-blueprint" aria-hidden="true">
                                <svg viewBox="0 0 200 60" className="ex-garage-blueprint-car">
                                    <path
                                        d="M8 44 L34 44 Q38 34 48 33 L74 31 Q92 20 116 20 L138 22 Q150 23 158 30 L182 33 Q192 35 192 44 L8 44 Z"
                                        fill="none" stroke="currentColor" strokeWidth="1.4"
                                    />
                                    <circle cx="52" cy="44" r="9" fill="none" stroke="currentColor" strokeWidth="1.4" />
                                    <circle cx="156" cy="44" r="9" fill="none" stroke="currentColor" strokeWidth="1.4" />
                                </svg>
                            </div>
                        }
                    />
                </div>

                {/* shutter door — rises on hover */}
                <div className="ex-garage-door" aria-hidden="true">
                    <span className="ex-garage-door-slats" />
                    <span className="ex-garage-door-edge" />
                </div>

                {/* bay number plate */}
                <span className="ex-garage-plate">
                    <span className="ex-garage-plate-pos">P{standing?.position ?? "—"}</span>
                    <span className="ex-garage-plate-label">CONSTRUCTOR</span>
                </span>
            </div>

            <div className="ex-garage-info">
                <div className="ex-garage-title-row">
                    <h3 className="ex-garage-name">{team.name}</h3>
                    <span className="ex-garage-points">
                        {standing?.points ?? "—"}
                        <em>PTS</em>
                    </span>
                </div>

                <div className="ex-garage-meta">
                    <span>{team.nationality}</span>
                    {info?.engineSupplier && (
                        <>
                            <span className="ex-garage-meta-dot" aria-hidden="true" />
                            <span>{info.engineSupplier.split("(")[0].trim()}</span>
                        </>
                    )}
                </div>

                {drivers.length > 0 && (
                    <div className="ex-garage-drivers">
                        {drivers.map((d) => (
                            <span key={d.Driver.driverId} className="ex-garage-driver">
                                <em>{d.Driver.permanentNumber ?? "—"}</em>
                                {d.Driver.familyName}
                            </span>
                        ))}
                    </div>
                )}

                <span className="ex-garage-cta" aria-hidden="true">ENTER GARAGE →</span>
            </div>
        </article>
    );
}

export default GarageCard;
