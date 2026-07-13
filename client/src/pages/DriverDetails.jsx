import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import driverInfo from "../data/driverInfo";
import LoadingSpinner from "../components/LoadingSpinner";
import KnowMoreModal from "../components/KnowMoreModal";
import { knowMoreInfo } from "../data/knowMoreInfo";
import KnowMoreTerm from "../components/KnowMoreTerm";
import LayeredImage from "../components/entity/LayeredImage";
import ExSection from "../components/entity/ExSection";
import TelemetryStat from "../components/entity/TelemetryStat";
import AnimatedNumber from "../components/entity/AnimatedNumber";
import { getDriverAssets, getTeamAccent } from "../config/driverAssets";
import "./EntityPages.css";

/*
 * DRIVER DOSSIER — the editorial profile a Driver Pass unfolds into.
 * The hero portrait and racing number carry the view-transition names
 * shared with the centered pass on THE GRID, so arriving here feels like
 * opening the credential rather than loading a new page.
 */
function DriverDetails() {
    const { year, id } = useParams();
    const [driver, setDriver] = useState(null);
    const [standing, setStanding] = useState(null);
    const [selectedTerm, setSelectedTerm] = useState(null);

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/${year}`)
            .then((res) => res.json())
            .then((data) => {
                const selected = data.find((ele) => ele.driverId === id);
                setDriver(selected);
            });
    }, [year, id]);

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/standings/${year}`)
            .then((res) => res.json())
            .then((data) => {
                const selectedStanding = data.find((ele) => ele.Driver.driverId === id);
                setStanding(selectedStanding);
            });
    }, [year, id]);

    if (!driver || !standing) {
        return (
            <div className="ex">
                <div className="ex-loading"><LoadingSpinner /></div>
            </div>
        );
    }

    const fullName = `${driver.givenName} ${driver.familyName}`;
    const age = new Date().getFullYear() - new Date(driver.dateOfBirth).getFullYear();
    const extraInfo = driverInfo[fullName];
    const team = standing.Constructors[0];
    const accent = getTeamAccent(team?.constructorId);
    const assets = getDriverAssets(driver.driverId, fullName);

    return (
        <div className="ex" style={{ "--accent": accent }}>
            {/* ── dossier hero ── */}
            <header className="ex-dossier-hero">
                <div className="ex-dossier-info">
                    <Link to="/drivers" viewTransition className="ex-back">
                        ← RETURN TO THE GRID
                    </Link>

                    <p className="ex-dossier-kicker">
                        <span className="ex-dossier-kicker-accent" aria-hidden="true" />
                        DRIVER DOSSIER · {year} SEASON
                    </p>

                    <h1 className="ex-dossier-name">
                        <span className="given">{driver.givenName}</span>
                        <span className="family">{driver.familyName}</span>
                    </h1>

                    {extraInfo?.nickname && (
                        <p className="ex-dossier-nickname">“{extraInfo.nickname}”</p>
                    )}

                    <div className="ex-dossier-tags">
                        <span className="ex-tag ex-tag--accent">{team?.name}</span>
                        <span className="ex-tag">{driver.nationality}</span>
                        <span className="ex-tag">CODE {driver.code}</span>
                        <span className="ex-tag">
                            <a href={driver.url} target="_blank" rel="noreferrer">
                                WIKIPEDIA ↗
                            </a>
                        </span>
                    </div>

                    <div className="ex-dossier-live">
                        <div className="ex-dossier-live-item">
                            <span className="ex-dossier-live-val">P{standing.position}</span>
                            <span className="ex-dossier-live-label">Championship</span>
                        </div>
                        <div className="ex-dossier-live-item">
                            <span className="ex-dossier-live-val">
                                <AnimatedNumber value={standing.points} />
                            </span>
                            <span className="ex-dossier-live-label">
                                <KnowMoreTerm term="points_system" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Points</KnowMoreTerm>
                            </span>
                        </div>
                        <div className="ex-dossier-live-item">
                            <span className="ex-dossier-live-val">
                                <AnimatedNumber value={standing.wins} />
                            </span>
                            <span className="ex-dossier-live-label">Wins · {year}</span>
                        </div>
                    </div>
                </div>

                <div className="ex-dossier-visual">
                    <span
                        className="ex-dossier-num"
                        aria-hidden="true"
                        style={{ viewTransitionName: "driver-number" }}
                    >
                        {driver.permanentNumber}
                    </span>
                    <div
                        className="ex-dossier-img-wrap"
                        style={{ viewTransitionName: "driver-portrait" }}
                    >
                        <LayeredImage
                            candidates={assets.imageCandidates}
                            alt={fullName}
                            className="ex-dossier-img"
                            fallback={
                                <div className="ex-entity-fallback" aria-hidden="true">
                                    <span>{driver.givenName[0]}{driver.familyName[0]}</span>
                                </div>
                            }
                        />
                    </div>
                </div>

                <div className="ex-dossier-floor" aria-hidden="true" />
            </header>

            <main className="ex-main">
                {extraInfo?.description && (
                    <ExSection eyebrow="Profile" title="The Story">
                        <p className="ex-prose">{extraInfo.description}</p>
                    </ExSection>
                )}

                <ExSection eyebrow="Credential" title="Driver File">
                    <div className="ex-spec">
                        <div className="ex-spec-row">
                            <span className="ex-spec-label">Nationality</span>
                            <span className="ex-spec-value">{driver.nationality}</span>
                        </div>
                        <div className="ex-spec-row">
                            <span className="ex-spec-label">Date of Birth</span>
                            <span className="ex-spec-value">{driver.dateOfBirth} · AGE {age}</span>
                        </div>
                        <div className="ex-spec-row">
                            <span className="ex-spec-label">Race Number</span>
                            <span className="ex-spec-value">#{driver.permanentNumber}</span>
                        </div>
                        <div className="ex-spec-row">
                            <span className="ex-spec-label">Driver Code</span>
                            <span className="ex-spec-value">{driver.code}</span>
                        </div>
                        {extraInfo?.debut && (
                            <div className="ex-spec-row">
                                <span className="ex-spec-label">F1 Debut</span>
                                <span className="ex-spec-value">{extraInfo.debut}</span>
                            </div>
                        )}
                        <div className="ex-spec-row">
                            <span className="ex-spec-label">Current Team</span>
                            <span className="ex-spec-value">{team?.name}</span>
                        </div>
                    </div>
                </ExSection>

                <ExSection eyebrow="Telemetry" title={`${year} Season`}>
                    <div className="ex-stat-row">
                        <TelemetryStat value={standing.position} label="Position" accent />
                        <TelemetryStat
                            value={standing.points}
                            label={
                                <KnowMoreTerm term="points_system" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Points</KnowMoreTerm>
                            }
                        />
                        <TelemetryStat value={standing.wins} label="Wins" />
                    </div>
                </ExSection>

                <ExSection eyebrow="Career" title="Career Statistics">
                    <div className="ex-stat-row">
                        <TelemetryStat
                            value={extraInfo?.championships ?? "—"}
                            label={
                                <KnowMoreTerm term="drivers_championship" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Championships</KnowMoreTerm>
                            }
                            meter={(extraInfo?.championships ?? 0) / 8}
                            accent
                        />
                        <TelemetryStat
                            value={extraInfo?.raceWins ?? "—"}
                            label="Race Wins"
                            meter={(extraInfo?.raceWins ?? 0) / 105}
                        />
                        <TelemetryStat
                            value={extraInfo?.podiums ?? "—"}
                            label={
                                <KnowMoreTerm term="podium" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Podiums</KnowMoreTerm>
                            }
                            meter={(extraInfo?.podiums ?? 0) / 200}
                        />
                        <TelemetryStat
                            value={extraInfo?.polePositions ?? "—"}
                            label={
                                <KnowMoreTerm term="pole_position" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Pole Positions</KnowMoreTerm>
                            }
                            meter={(extraInfo?.polePositions ?? 0) / 104}
                        />
                    </div>
                    {extraInfo?.bestSeason && (
                        <p className="ex-prose" style={{ marginTop: 22 }}>
                            <strong>Best season —</strong> {extraInfo.bestSeason}
                        </p>
                    )}
                </ExSection>

                {extraInfo?.drivingStyle && (
                    <ExSection eyebrow="On Track" title="Driving Style">
                        <p className="ex-prose">{extraInfo.drivingStyle}</p>
                    </ExSection>
                )}

                {extraInfo?.careerHighlights?.length > 0 && (
                    <ExSection eyebrow="Milestones" title="Career Timeline">
                        <ul className="ex-timeline">
                            {extraInfo.careerHighlights.map((highlight, index) => (
                                <li key={index}>{highlight}</li>
                            ))}
                        </ul>
                    </ExSection>
                )}

                {extraInfo?.famousRaces?.length > 0 && (
                    <ExSection eyebrow="Signature Drives" title="Famous Races">
                        <ul className="ex-list">
                            {extraInfo.famousRaces.map((race, index) => (
                                <li key={index}>{race}</li>
                            ))}
                        </ul>
                    </ExSection>
                )}

                {extraInfo?.funFacts?.length > 0 && (
                    <ExSection eyebrow="Paddock Notes" title="Fun Facts">
                        <ul className="ex-list">
                            {extraInfo.funFacts.map((fact, index) => (
                                <li key={index}>{fact}</li>
                            ))}
                        </ul>
                    </ExSection>
                )}

                {extraInfo?.quote && (
                    <ExSection eyebrow="Team Radio" title="In Their Own Words">
                        <blockquote className="ex-quote">
                            “{extraInfo.quote}”
                            <cite>{fullName.toUpperCase()}</cite>
                        </blockquote>
                    </ExSection>
                )}
            </main>

            <KnowMoreModal info={selectedTerm} onClose={() => setSelectedTerm(null)} />
        </div>
    );
}

export default DriverDetails;
