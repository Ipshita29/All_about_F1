import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import teamInfo from "../data/teamInfo";
import ImagePlaceholder from "../components/ImagePlaceholder";
import LoadingSpinner from "../components/LoadingSpinner";
import KnowMoreModal from "../components/KnowMoreModal";
import { knowMoreInfo } from "../data/knowMoreInfo";
import KnowMoreTerm from "../components/KnowMoreTerm";

function TeamDetails() {
    const { year, id } = useParams();
    const [team, setTeam] = useState(null);
    const [standing, setStanding] = useState(null);
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

    if (!team || !standing) return <div className="loading"><LoadingSpinner /></div>;

    const extraInfo = teamInfo[team.constructorId];
    const teamColor = extraInfo?.teamColors?.primary;

    return (
        <div className="page detail-page">
            <div className="team-profile-hero" style={{ "--team-color": teamColor || "#E10600" }}>
                <div className="team-profile-hero-img-wrap">
                    <ImagePlaceholder name={team.name} type="team" color={teamColor || "#E10600"} className="entity-placeholder" />
                    {extraInfo?.image && (
                        <img
                            src={extraInfo.image}
                            alt={`${team.name} car`}
                            className="team-profile-hero-img"
                            onError={(e) => { e.target.style.display = "none"; }}
                        />
                    )}
                </div>
                <div className="team-profile-hero-info">
                    {extraInfo?.logo && (
                        <img
                            src={extraInfo.logo}
                            alt={`${team.name} logo`}
                            className="team-profile-logo"
                        />
                    )}
                    <h1>{team.name}</h1>
                </div>
            </div>
            {teamColor && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {extraInfo.teamColors.primary && (
                        <div className="color-box" style={{ backgroundColor: extraInfo.teamColors.primary }} title="Primary" />
                    )}
                    {extraInfo.teamColors.secondary && (
                        <div className="color-box" style={{ backgroundColor: extraInfo.teamColors.secondary }} title="Secondary" />
                    )}
                    {extraInfo.teamColors.accent && (
                        <div className="color-box" style={{ backgroundColor: extraInfo.teamColors.accent }} title="Accent" />
                    )}
                </div>
            )}
            <p>
                <a href={team.url} target="_blank" rel="noreferrer">
                    {team.name}'s Wikipedia Profile
                </a>
            </p>

            {extraInfo?.history && (
                <>
                    <h2>History</h2>
                    <p>{extraInfo.history}</p>
                </>
            )}

            <h2>Team Info</h2>
            <div className="info-card" style={{ padding: "16px 20px" }}>
                <div className="detail-info-row">
                    <span className="detail-info-label">Nationality</span>
                    <span className="detail-info-value">{team.nationality}</span>
                </div>
                {extraInfo?.founded && (
                    <div className="detail-info-row">
                        <span className="detail-info-label">Founded</span>
                        <span className="detail-info-value">{extraInfo.founded}</span>
                    </div>
                )}
                {extraInfo?.headquarters && (
                    <div className="detail-info-row">
                        <span className="detail-info-label">Headquarters</span>
                        <span className="detail-info-value">{extraInfo.headquarters}</span>
                    </div>
                )}
                {extraInfo?.teamPrincipal && (
                    <div className="detail-info-row">
                        <span className="detail-info-label">Team Principal</span>
                        <span className="detail-info-value">{extraInfo.teamPrincipal}</span>
                    </div>
                )}
                {extraInfo?.engineSupplier && (
                    <div className="detail-info-row">
                        <span className="detail-info-label">Engine Supplier</span>
                        <span className="detail-info-value">{extraInfo.engineSupplier}</span>
                    </div>
                )}
            </div>

            <h2>{year} Season</h2>
            <div className="stat-row">
                <div className="stat-box">
                    <span className="stat-value">{standing.position}</span>
                    <span className="stat-label">
                        <KnowMoreTerm term="championship_leader" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Position</KnowMoreTerm>
                    </span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{standing.points}</span>
                    <span className="stat-label">
                        <KnowMoreTerm term="points_system" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Points</KnowMoreTerm>
                    </span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{standing.wins}</span>
                    <span className="stat-label">Wins</span>
                </div>
            </div>

            <h2>
                <KnowMoreTerm term="constructors_championship" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Championships</KnowMoreTerm>
            </h2>
            <p>Total Championships: {extraInfo?.championships ?? "—"}</p>

            {extraInfo?.achievements?.length > 0 && (
                <>
                    <h2>Achievements</h2>
                    <ul>
                        {extraInfo.achievements.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                </>
            )}

            {extraInfo?.famousDrivers?.length > 0 && (
                <>
                    <h2>Famous Drivers</h2>
                    <ul>
                        {extraInfo.famousDrivers.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                </>
            )}

            {extraInfo?.strategyStyle && (
                <>
                    <h2>Strategy Style</h2>
                    <p>{extraInfo.strategyStyle}</p>
                    <p>
                        {"Key tools: "}
                        <KnowMoreTerm term="undercut" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>undercut</KnowMoreTerm>
                        {", "}
                        <KnowMoreTerm term="pit_stop" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>pit stop</KnowMoreTerm>
                        {", and "}
                        <KnowMoreTerm term="tyre_management" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>tyre management</KnowMoreTerm>
                        {"."}
                    </p>
                </>
            )}

            {(extraInfo?.strengths?.length > 0 || extraInfo?.weaknesses?.length > 0) && (
                <>
                    <h2>Strengths & Weaknesses</h2>
                    <div className="info-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        {extraInfo?.strengths?.length > 0 && (
                            <div>
                                <h3 style={{ color: "#15a34a", marginBottom: 8 }}>Strengths</h3>
                                <ul style={{ margin: 0 }}>
                                    {extraInfo.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                        )}
                        {extraInfo?.weaknesses?.length > 0 && (
                            <div>
                                <h3 style={{ color: "#E10600", marginBottom: 8 }}>Weaknesses</h3>
                                <ul style={{ margin: 0 }}>
                                    {extraInfo.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                </>
            )}

            {extraInfo?.funFacts?.length > 0 && (
                <>
                    <h2>Fun Facts</h2>
                    <ul>
                        {extraInfo.funFacts.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                </>
            )}

            {(extraInfo?.socials?.instagram || extraInfo?.socials?.twitter || extraInfo?.socials?.website) && (
                <>
                    <h2>Social Links</h2>
                    <div className="info-card" style={{ padding: "16px 20px" }}>
                        {extraInfo.socials.instagram && (
                            <div className="detail-info-row">
                                <span className="detail-info-label">Instagram</span>
                                <a
                                    href={`https://instagram.com/${extraInfo.socials.instagram.replace("@", "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="detail-info-value"
                                >
                                    {extraInfo.socials.instagram}
                                </a>
                            </div>
                        )}
                        {extraInfo.socials.twitter && (
                            <div className="detail-info-row">
                                <span className="detail-info-label">Twitter / X</span>
                                <a
                                    href={`https://x.com/${extraInfo.socials.twitter.replace("@", "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="detail-info-value"
                                >
                                    {extraInfo.socials.twitter}
                                </a>
                            </div>
                        )}
                        {extraInfo.socials.website && (
                            <div className="detail-info-row">
                                <span className="detail-info-label">Website</span>
                                <a
                                    href={extraInfo.socials.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="detail-info-value"
                                >
                                    Official Website →
                                </a>
                            </div>
                        )}
                    </div>
                </>
            )}

            <KnowMoreModal info={selectedTerm} onClose={() => setSelectedTerm(null)} />
        </div>
    );
}

export default TeamDetails;
