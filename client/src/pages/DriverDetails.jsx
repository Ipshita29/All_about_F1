import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import driverInfo from "../data/driverInfo";
import LoadingSpinner from "../components/LoadingSpinner";
import ImagePlaceholder from "../components/ImagePlaceholder";
import KnowMoreModal from "../components/KnowMoreModal";
import { knowMoreInfo } from "../data/knowMoreInfo";
import KnowMoreTerm from "../components/KnowMoreTerm";

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

    if (!driver || !standing) return <div className="loading"><LoadingSpinner /></div>;

    const age = new Date().getFullYear() - new Date(driver.dateOfBirth).getFullYear();
    const extraInfo = driverInfo[`${driver.givenName} ${driver.familyName}`];

    return (
        <div className="page detail-page">
            <div className="driver-profile-hero">
                <div className="driver-profile-hero-info">
                    <h1>{driver.givenName} {driver.familyName}</h1>
                    {extraInfo?.nickname && <p className="driver-nickname">"{extraInfo.nickname}"</p>}
                    <p>
                        <a href={driver.url} target="_blank" rel="noreferrer">
                            {driver.familyName}'s Wikipedia Profile
                        </a>
                    </p>
                </div>
                <div className="driver-profile-img-wrap">
                    <ImagePlaceholder
                        name={`${driver.givenName} ${driver.familyName}`}
                        type="driver"
                        className="entity-placeholder"
                    />
                    {extraInfo?.image && (
                        <img
                            src={extraInfo.image}
                            alt={`${driver.givenName} ${driver.familyName}`}
                            className="driver-profile-img"
                            onError={(e) => { e.target.style.display = "none"; }}
                        />
                    )}
                </div>
            </div>

            {extraInfo?.description && (
                <>
                    <h2>About</h2>
                    <p>{extraInfo.description}</p>
                </>
            )}

            <h2>Driver Info</h2>
            <div className="info-card" style={{ padding: "16px 20px" }}>
                <div className="detail-info-row">
                    <span className="detail-info-label">Nationality</span>
                    <span className="detail-info-value">{driver.nationality}</span>
                </div>
                <div className="detail-info-row">
                    <span className="detail-info-label">Date of Birth</span>
                    <span className="detail-info-value">{driver.dateOfBirth} (age {age})</span>
                </div>
                <div className="detail-info-row">
                    <span className="detail-info-label">Car Number</span>
                    <span className="detail-info-value">#{driver.permanentNumber}</span>
                </div>
                <div className="detail-info-row">
                    <span className="detail-info-label">Code</span>
                    <span className="detail-info-value">{driver.code}</span>
                </div>
                {extraInfo?.debut && (
                    <div className="detail-info-row">
                        <span className="detail-info-label">F1 Debut</span>
                        <span className="detail-info-value">{extraInfo.debut}</span>
                    </div>
                )}
                <div className="detail-info-row">
                    <span className="detail-info-label">Current Team</span>
                    <span className="detail-info-value">{standing.Constructors[0].name}</span>
                </div>
            </div>

            <h2>{year} Season</h2>
            <div className="stat-row">
                <div className="stat-box">
                    <span className="stat-value">{standing.position}</span>
                    <span className="stat-label">Position</span>
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

            <h2>Career Stats</h2>
            <div className="stat-row">
                <div className="stat-box">
                    <span className="stat-value">{extraInfo?.championships ?? "—"}</span>
                    <span className="stat-label">
                        <KnowMoreTerm term="drivers_championship" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Championships</KnowMoreTerm>
                    </span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{extraInfo?.raceWins ?? "—"}</span>
                    <span className="stat-label">Race Wins</span>
                </div>
                <div className="stat-box">
                    <span className="stat-value">{extraInfo?.podiums ?? "—"}</span>
                    <span className="stat-label">
                        <KnowMoreTerm term="podium" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Podiums</KnowMoreTerm>
                    </span>
                </div>
            </div>
            <p>
                <KnowMoreTerm term="pole_position" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Pole Positions</KnowMoreTerm>
                {": "}{extraInfo?.polePositions ?? "—"}
            </p>
            {extraInfo?.bestSeason && <p>Best Season: {extraInfo.bestSeason}</p>}

            {extraInfo?.drivingStyle && (
                <>
                    <h2>Driving Style</h2>
                    <p>{extraInfo.drivingStyle}</p>
                </>
            )}

            {extraInfo?.careerHighlights?.length > 0 && (
                <>
                    <h2>Career Highlights</h2>
                    <ul>
                        {extraInfo.careerHighlights.map((highlight, index) => (
                            <li key={index}>{highlight}</li>
                        ))}
                    </ul>
                </>
            )}

            {extraInfo?.famousRaces?.length > 0 && (
                <>
                    <h2>Famous Races</h2>
                    <ul>
                        {extraInfo.famousRaces.map((race, index) => (
                            <li key={index}>{race}</li>
                        ))}
                    </ul>
                </>
            )}

            {extraInfo?.funFacts?.length > 0 && (
                <>
                    <h2>Fun Facts</h2>
                    <ul>
                        {extraInfo.funFacts.map((fact, index) => (
                            <li key={index}>{fact}</li>
                        ))}
                    </ul>
                </>
            )}

            {extraInfo?.quote && (
                <>
                    <h2>In Their Own Words</h2>
                    <div className="detail-quote">
                        <p>"{extraInfo.quote}"</p>
                    </div>
                </>
            )}

            <KnowMoreModal info={selectedTerm} onClose={() => setSelectedTerm(null)} />
        </div>
    );
}

export default DriverDetails;
