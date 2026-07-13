import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import teamInfo from "../data/teamInfo";
import LoadingSpinner from "../components/LoadingSpinner";
import KnowMoreModal from "../components/KnowMoreModal";
import { knowMoreInfo } from "../data/knowMoreInfo";
import KnowMoreTerm from "../components/KnowMoreTerm";
import LayeredImage from "../components/entity/LayeredImage";
import ExSection from "../components/entity/ExSection";
import TelemetryStat from "../components/entity/TelemetryStat";
import AnimatedNumber from "../components/entity/AnimatedNumber";
import { getTeamAssets } from "../config/teamAssets";
import "./EntityPages.css";

/*
 * INSIDE THE GARAGE — the engineering-focused constructor profile that a
 * Pit Lane garage bay opens into. The hero centres on the car (shared
 * element with the bay interior) over a blueprint sheet; everything below
 * reads like a technical file rather than a personality piece.
 */
function TeamDetails() {
    const { year, id } = useParams();
    const [team, setTeam] = useState(null);
    const [standing, setStanding] = useState(null);
    const [driverStandings, setDriverStandings] = useState([]);
    const [selectedTerm, setSelectedTerm] = useState(null);

    useEffect(() => {
        fetch(`http://localhost:3000/teams/${year}`)
            .then((res) => res.json())
            .then((data) => {
                const selected = data.find((ele) => ele.constructorId === id);
                setTeam(selected);
            });
    }, [year, id]);

    useEffect(() => {
        fetch(`http://localhost:3000/teams/standings/${year}`)
            .then((res) => res.json())
            .then((data) => {
                const selectedStanding = data.find(
                    (ele) => ele.Constructor.constructorId === id
                );
                setStanding(selectedStanding);
            });
    }, [year, id]);

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setDriverStandings(Array.isArray(data) ? data : []))
            .catch(() => setDriverStandings([]));
    }, [year]);

    if (!team || !standing) {
        return (
            <div className="ex">
                <div className="ex-loading"><LoadingSpinner /></div>
            </div>
        );
    }

    const extraInfo = teamInfo[team.constructorId];
    const assets = getTeamAssets(team.constructorId);
    const drivers = driverStandings.filter(
        (d) => d.Constructors?.[0]?.constructorId === team.constructorId
    );

    return (
        <div className="ex" style={{ "--accent": assets.accent }}>
            {/* ── garage hero: the car under the lights ── */}
            <header className="ex-tg-hero">
                <Link to="/teams" viewTransition className="ex-back">
                    ← BACK TO PIT LANE
                </Link>

                <p className="ex-tg-kicker" style={{ display: "block", marginTop: 26 }}>
                    CONSTRUCTOR GARAGE · {year} SEASON
                </p>

                <h1 className="ex-tg-name">{team.name}</h1>

                <div className="ex-dossier-tags" style={{ justifyContent: "center" }}>
                    <span className="ex-tag ex-tag--accent">{team.nationality}</span>
                    {extraInfo?.founded && <span className="ex-tag">EST. {extraInfo.founded}</span>}
                    <span className="ex-tag">
                        <a href={team.url} target="_blank" rel="noreferrer">WIKIPEDIA ↗</a>
                    </span>
                </div>

                <div
                    className="ex-tg-carline"
                    style={{ viewTransitionName: `team-car-${team.constructorId}` }}
                >
                    <LayeredImage
                        candidates={assets.carCandidates}
                        alt={`${team.name} Formula 1 car`}
                        className="ex-tg-car"
                        fallback={
                            <div className="ex-entity-fallback" aria-hidden="true">
                                <span>{team.name.slice(0, 2).toUpperCase()}</span>
                            </div>
                        }
                    />
                </div>
                <div className="ex-tg-floor" aria-hidden="true" />

                <div className="ex-tg-statline">
                    <div className="ex-dossier-live-item">
                        <span className="ex-dossier-live-val">P{standing.position}</span>
                        <span className="ex-dossier-live-label">
                            <KnowMoreTerm term="championship_leader" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Championship</KnowMoreTerm>
                        </span>
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
                    <div className="ex-dossier-live-item">
                        <span className="ex-dossier-live-val">
                            <AnimatedNumber value={extraInfo?.championships ?? "—"} />
                        </span>
                        <span className="ex-dossier-live-label">
                            <KnowMoreTerm term="constructors_championship" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Titles</KnowMoreTerm>
                        </span>
                    </div>
                </div>
            </header>

            <main className="ex-main">
                {drivers.length > 0 && (
                    <ExSection eyebrow="Race Crew" title="Current Drivers">
                        <div className="ex-pitlane" style={{ paddingTop: 0 }}>
                            {drivers.map((d) => (
                                <Link
                                    key={d.Driver.driverId}
                                    to={`/drivers/${year}/${d.Driver.driverId}`}
                                    className="ex-spec"
                                    style={{ display: "block" }}
                                >
                                    <div className="ex-spec-row">
                                        <span className="ex-spec-label">
                                            #{d.Driver.permanentNumber} · {d.Driver.code}
                                        </span>
                                        <span className="ex-spec-value">
                                            {d.Driver.givenName} {d.Driver.familyName}
                                        </span>
                                    </div>
                                    <div className="ex-spec-row">
                                        <span className="ex-spec-label">P{d.position} · {d.points} PTS</span>
                                        <span className="ex-spec-value">{d.Driver.nationality}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </ExSection>
                )}

                {extraInfo?.history && (
                    <ExSection eyebrow="Heritage" title="History">
                        <p className="ex-prose">{extraInfo.history}</p>
                    </ExSection>
                )}

                <ExSection eyebrow="Technical File" title="Team Specification">
                    <div className="ex-spec">
                        <div className="ex-spec-row">
                            <span className="ex-spec-label">Nationality</span>
                            <span className="ex-spec-value">{team.nationality}</span>
                        </div>
                        {extraInfo?.founded && (
                            <div className="ex-spec-row">
                                <span className="ex-spec-label">Founded</span>
                                <span className="ex-spec-value">{extraInfo.founded}</span>
                            </div>
                        )}
                        {extraInfo?.headquarters && (
                            <div className="ex-spec-row">
                                <span className="ex-spec-label">Factory</span>
                                <span className="ex-spec-value">{extraInfo.headquarters}</span>
                            </div>
                        )}
                        {extraInfo?.teamPrincipal && (
                            <div className="ex-spec-row">
                                <span className="ex-spec-label">Team Principal</span>
                                <span className="ex-spec-value">{extraInfo.teamPrincipal}</span>
                            </div>
                        )}
                        {extraInfo?.engineSupplier && (
                            <div className="ex-spec-row">
                                <span className="ex-spec-label">Power Unit</span>
                                <span className="ex-spec-value">{extraInfo.engineSupplier}</span>
                            </div>
                        )}
                    </div>
                </ExSection>

                <ExSection eyebrow="Telemetry" title={`${year} Season`}>
                    <div className="ex-stat-row">
                        <TelemetryStat value={standing.position} label="Position" accent />
                        <TelemetryStat value={standing.points} label="Points" />
                        <TelemetryStat value={standing.wins} label="Wins" />
                        <TelemetryStat
                            value={extraInfo?.championships ?? "—"}
                            label="Constructor Titles"
                            meter={(extraInfo?.championships ?? 0) / 16}
                        />
                    </div>
                </ExSection>

                {extraInfo?.achievements?.length > 0 && (
                    <ExSection eyebrow="Honours" title="Championship Record">
                        <ul className="ex-timeline">
                            {extraInfo.achievements.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                    </ExSection>
                )}

                {extraInfo?.famousDrivers?.length > 0 && (
                    <ExSection eyebrow="Hall of Fame" title="Famous Drivers">
                        <ul className="ex-list">
                            {extraInfo.famousDrivers.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                    </ExSection>
                )}

                {extraInfo?.strategyStyle && (
                    <ExSection eyebrow="Pit Wall" title="Strategy Style">
                        <p className="ex-prose">{extraInfo.strategyStyle}</p>
                        <p className="ex-prose" style={{ marginTop: 14 }}>
                            {"Key tools: "}
                            <KnowMoreTerm term="undercut" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>undercut</KnowMoreTerm>
                            {", "}
                            <KnowMoreTerm term="pit_stop" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>pit stop</KnowMoreTerm>
                            {", and "}
                            <KnowMoreTerm term="tyre_management" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>tyre management</KnowMoreTerm>
                            {"."}
                        </p>
                    </ExSection>
                )}

                {(extraInfo?.strengths?.length > 0 || extraInfo?.weaknesses?.length > 0) && (
                    <ExSection eyebrow="Engineering Readout" title="Strengths & Weaknesses">
                        <div className="ex-cols">
                            {extraInfo?.strengths?.length > 0 && (
                                <div>
                                    <span className="ex-eyebrow" style={{ color: "#8fae8f" }}>
                                        OPERATING WITHIN LIMITS
                                    </span>
                                    <ul className="ex-list">
                                        {extraInfo.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                            )}
                            {extraInfo?.weaknesses?.length > 0 && (
                                <div>
                                    <span className="ex-eyebrow" style={{ color: "#c98a84" }}>
                                        FLAGGED FOR DEVELOPMENT
                                    </span>
                                    <ul className="ex-list">
                                        {extraInfo.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </ExSection>
                )}

                {extraInfo?.funFacts?.length > 0 && (
                    <ExSection eyebrow="Paddock Notes" title="Fun Facts">
                        <ul className="ex-list">
                            {extraInfo.funFacts.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                    </ExSection>
                )}

                {(extraInfo?.socials?.instagram || extraInfo?.socials?.twitter || extraInfo?.socials?.website) && (
                    <ExSection eyebrow="Comms" title="Official Channels">
                        <div className="ex-spec">
                            {extraInfo.socials.instagram && (
                                <div className="ex-spec-row">
                                    <span className="ex-spec-label">Instagram</span>
                                    <a
                                        href={`https://instagram.com/${extraInfo.socials.instagram.replace("@", "")}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ex-spec-value"
                                    >
                                        {extraInfo.socials.instagram}
                                    </a>
                                </div>
                            )}
                            {extraInfo.socials.twitter && (
                                <div className="ex-spec-row">
                                    <span className="ex-spec-label">Twitter / X</span>
                                    <a
                                        href={`https://x.com/${extraInfo.socials.twitter.replace("@", "")}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ex-spec-value"
                                    >
                                        {extraInfo.socials.twitter}
                                    </a>
                                </div>
                            )}
                            {extraInfo.socials.website && (
                                <div className="ex-spec-row">
                                    <span className="ex-spec-label">Website</span>
                                    <a
                                        href={extraInfo.socials.website}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ex-spec-value"
                                    >
                                        Official Website ↗
                                    </a>
                                </div>
                            )}
                        </div>
                    </ExSection>
                )}
            </main>

            <KnowMoreModal info={selectedTerm} onClose={() => setSelectedTerm(null)} />
        </div>
    );
}

export default TeamDetails;
