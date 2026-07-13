import { useState, useEffect } from "react";
import driverInfo from "../data/driverInfo";
import KnowMoreModal from "../components/KnowMoreModal";
import { knowMoreInfo } from "../data/knowMoreInfo";
import KnowMoreTerm from "../components/KnowMoreTerm";
import LayeredImage from "../components/entity/LayeredImage";
import ExSection from "../components/entity/ExSection";
import DuelMeter from "../components/entity/DuelMeter";
import EntitySelect from "../components/entity/EntitySelect";
import { getDriverAssets, getTeamAccent } from "../config/driverAssets";
import "./EntityPages.css";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

/*
 * WHEEL TO WHEEL — driver comparison as a rivalry, not a spreadsheet.
 * Two drivers face each other from opposite sides of the screen, each side
 * tinted by its team; statistics race outward from a centre spine on
 * telemetry-style duel meters. Swapping one driver re-enters only that
 * side of the composition (keyed side panels).
 */

/* one half of the hero — keyed by driverId so a swap animates only itself */
function W2WSide({ side, driver, standing }) {
    const fullName = `${driver.givenName} ${driver.familyName}`;
    const team = standing?.Constructors?.[0];
    const accent = getTeamAccent(team?.constructorId);
    const assets = getDriverAssets(driver.driverId, fullName);

    return (
        <div className={`ex-w2w-side ex-w2w-side--${side}`} style={{ "--accent": accent }}>
            <div className="ex-w2w-portrait">
                <span className="ex-w2w-num" aria-hidden="true">
                    {driver.permanentNumber}
                </span>
                <LayeredImage
                    candidates={assets.imageCandidates}
                    alt={fullName}
                    className="ex-w2w-img"
                    fallback={
                        <div className="ex-entity-fallback" aria-hidden="true">
                            <span>{driver.givenName[0]}{driver.familyName[0]}</span>
                        </div>
                    }
                />
            </div>
            <span className="ex-w2w-id-given">{driver.givenName}</span>
            <span className="ex-w2w-id-family">{driver.familyName}</span>
            <div>
                <span className="ex-w2w-id-team">
                    {team?.name ?? "—"} · {driver.nationality}
                </span>
            </div>
        </div>
    );
}

function DriverComparison() {
    const [drivers, setDrivers] = useState([]);
    const [driver1, setDriver1] = useState("");
    const [driver2, setDriver2] = useState("");
    const [year, setYear] = useState("2026");
    const [standings, setStandings] = useState([]);
    const [selectedTerm, setSelectedTerm] = useState(null);

    const d1 = drivers.find((d) => d.driverId === driver1);
    const d2 = drivers.find((d) => d.driverId === driver2);
    const info1 = d1 ? driverInfo[`${d1.givenName} ${d1.familyName}`] : null;
    const info2 = d2 ? driverInfo[`${d2.givenName} ${d2.familyName}`] : null;
    const s1 = standings.find((s) => s.Driver.driverId === driver1);
    const s2 = standings.find((s) => s.Driver.driverId === driver2);

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/${year}`)
            .then((res) => res.json())
            .then((data) => setDrivers(data));
    }, [year]);

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setStandings(data));
    }, [year]);

    const accent1 = getTeamAccent(s1?.Constructors?.[0]?.constructorId);
    const accent2 = getTeamAccent(s2?.Constructors?.[0]?.constructorId);

    return (
        <div className="ex ex-w2w-page">
            <header className="ex-hero">
                <span className="ex-hero-eyebrow">Formula 1 · Head to Head</span>
                <h1 className="ex-hero-title">Wheel to Wheel</h1>
                <p className="ex-hero-sub">Every Statistic. Every Rivalry. Every Advantage.</p>
                <div className="ex-hero-rule" aria-hidden="true" />

                <div className="ex-controls">
                    <label className="ex-field">
                        <span className="ex-field-label">SEASON</span>
                        <select value={year} onChange={(e) => setYear(e.target.value)}>
                            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </label>
                    <EntitySelect
                        label="CAR 1"
                        placeholder="Select driver"
                        searchPlaceholder="Search drivers…"
                        value={driver1}
                        onChange={setDriver1}
                        options={drivers}
                        getId={(d) => d.driverId}
                        getLabel={(d) => `${d.givenName} ${d.familyName}`}
                        getSubLabel={(d) =>
                            standings.find((s) => s.Driver.driverId === d.driverId)
                                ?.Constructors?.[0]?.name ?? d.nationality
                        }
                    />
                    <EntitySelect
                        label="CAR 2"
                        placeholder="Select driver"
                        searchPlaceholder="Search drivers…"
                        value={driver2}
                        onChange={setDriver2}
                        options={drivers}
                        getId={(d) => d.driverId}
                        getLabel={(d) => `${d.givenName} ${d.familyName}`}
                        getSubLabel={(d) =>
                            standings.find((s) => s.Driver.driverId === d.driverId)
                                ?.Constructors?.[0]?.name ?? d.nationality
                        }
                    />
                </div>
            </header>

            {!d1 || !d2 ? (
                <main className="ex-main">
                    <div className="ex-empty">
                        <span className="ex-empty-title">Two cars. One straight.</span>
                        <span className="ex-empty-sub">
                            SELECT TWO DRIVERS ABOVE TO LINE THEM UP
                        </span>
                    </div>
                </main>
            ) : (
                <>
                    {/* ── facing hero ── */}
                    <div className="ex-w2w-hero">
                        <W2WSide key={`l-${d1.driverId}`} side="left" driver={d1} standing={s1} />
                        <div className="ex-w2w-center">
                            <span className="ex-w2w-vs">VS</span>
                            <span className="ex-w2w-season">{year} SEASON</span>
                        </div>
                        <W2WSide key={`r-${d2.driverId}`} side="right" driver={d2} standing={s2} />
                    </div>

                    <main className="ex-main">
                        <ExSection eyebrow="Telemetry" title={`${year} Season`}>
                            <div className="ex-duel-block">
                                <DuelMeter
                                    val1={s1?.position}
                                    val2={s2?.position}
                                    lowerIsBetter
                                    accent1={accent1}
                                    accent2={accent2}
                                >
                                    <KnowMoreTerm term="championship_leader" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Championship Pos.</KnowMoreTerm>
                                </DuelMeter>
                                <DuelMeter
                                    val1={s1?.points}
                                    val2={s2?.points}
                                    accent1={accent1}
                                    accent2={accent2}
                                >
                                    <KnowMoreTerm term="points_system" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Points</KnowMoreTerm>
                                </DuelMeter>
                                <DuelMeter
                                    label="Race Wins"
                                    val1={s1?.wins}
                                    val2={s2?.wins}
                                    accent1={accent1}
                                    accent2={accent2}
                                />
                            </div>
                        </ExSection>

                        <ExSection eyebrow="The Long Game" title="Career">
                            <div className="ex-duel-block">
                                <DuelMeter
                                    val1={info1?.championships}
                                    val2={info2?.championships}
                                    accent1={accent1}
                                    accent2={accent2}
                                >
                                    <KnowMoreTerm term="drivers_championship" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Championships</KnowMoreTerm>
                                </DuelMeter>
                                <DuelMeter
                                    label="Race Wins"
                                    val1={info1?.raceWins}
                                    val2={info2?.raceWins}
                                    accent1={accent1}
                                    accent2={accent2}
                                />
                                <DuelMeter
                                    val1={info1?.podiums}
                                    val2={info2?.podiums}
                                    accent1={accent1}
                                    accent2={accent2}
                                >
                                    <KnowMoreTerm term="podium" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Podiums</KnowMoreTerm>
                                </DuelMeter>
                                <DuelMeter
                                    val1={info1?.polePositions}
                                    val2={info2?.polePositions}
                                    accent1={accent1}
                                    accent2={accent2}
                                >
                                    <KnowMoreTerm term="pole_position" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Pole Positions</KnowMoreTerm>
                                </DuelMeter>
                            </div>
                        </ExSection>

                        <ExSection eyebrow="Credentials" title="Driver Profile">
                            <div className="ex-cols">
                                <div className="ex-spec">
                                    <div className="ex-spec-row">
                                        <span className="ex-spec-label">Nationality</span>
                                        <span className="ex-spec-value">{d1.nationality}</span>
                                    </div>
                                    <div className="ex-spec-row">
                                        <span className="ex-spec-label">Date of Birth</span>
                                        <span className="ex-spec-value">{d1.dateOfBirth}</span>
                                    </div>
                                    <div className="ex-spec-row">
                                        <span className="ex-spec-label">Driver Code</span>
                                        <span className="ex-spec-value">{d1.code}</span>
                                    </div>
                                    <div className="ex-spec-row">
                                        <span className="ex-spec-label">F1 Debut</span>
                                        <span className="ex-spec-value">{info1?.debut ?? "—"}</span>
                                    </div>
                                    <div className="ex-spec-row">
                                        <span className="ex-spec-label">Best Season</span>
                                        <span className="ex-spec-value">{info1?.bestSeason ?? "—"}</span>
                                    </div>
                                </div>
                                <div className="ex-spec">
                                    <div className="ex-spec-row">
                                        <span className="ex-spec-label">Nationality</span>
                                        <span className="ex-spec-value">{d2.nationality}</span>
                                    </div>
                                    <div className="ex-spec-row">
                                        <span className="ex-spec-label">Date of Birth</span>
                                        <span className="ex-spec-value">{d2.dateOfBirth}</span>
                                    </div>
                                    <div className="ex-spec-row">
                                        <span className="ex-spec-label">Driver Code</span>
                                        <span className="ex-spec-value">{d2.code}</span>
                                    </div>
                                    <div className="ex-spec-row">
                                        <span className="ex-spec-label">F1 Debut</span>
                                        <span className="ex-spec-value">{info2?.debut ?? "—"}</span>
                                    </div>
                                    <div className="ex-spec-row">
                                        <span className="ex-spec-label">Best Season</span>
                                        <span className="ex-spec-value">{info2?.bestSeason ?? "—"}</span>
                                    </div>
                                </div>
                            </div>
                        </ExSection>

                        {(info1 || info2) && (
                            <ExSection eyebrow="The Rivalry" title="Two Stories">
                                <div className="ex-about-cols">
                                    <div>
                                        {info1?.quote && (
                                            <blockquote className="ex-quote" style={{ marginBottom: 20 }}>
                                                “{info1.quote}”
                                                <cite>{d1.givenName} {d1.familyName}</cite>
                                            </blockquote>
                                        )}
                                        <p className="ex-prose">{info1?.description ?? "—"}</p>
                                    </div>
                                    <div className="ex-about-divider" aria-hidden="true" />
                                    <div>
                                        {info2?.quote && (
                                            <blockquote className="ex-quote" style={{ marginBottom: 20 }}>
                                                “{info2.quote}”
                                                <cite>{d2.givenName} {d2.familyName}</cite>
                                            </blockquote>
                                        )}
                                        <p className="ex-prose">{info2?.description ?? "—"}</p>
                                    </div>
                                </div>
                            </ExSection>
                        )}
                    </main>
                </>
            )}

            <KnowMoreModal info={selectedTerm} onClose={() => setSelectedTerm(null)} />
        </div>
    );
}

export default DriverComparison;
