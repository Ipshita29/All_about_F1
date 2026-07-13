import { useState, useEffect } from "react";
import teamInfo from "../data/teamInfo";
import LayeredImage from "../components/entity/LayeredImage";
import ExSection from "../components/entity/ExSection";
import DuelMeter from "../components/entity/DuelMeter";
import EntitySelect from "../components/entity/EntitySelect";
import { getTeamAssets } from "../config/teamAssets";
import "./EntityPages.css";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

/*
 * CONSTRUCTOR BATTLE — team comparison as an engineering duel.
 * Two cars face one another under garage light cones; the data below is a
 * technical comparison of the machines and organisations rather than a
 * personality contest. Swapping one constructor re-enters only that side.
 */

/* one half of the hero — keyed by constructorId so a swap animates only itself */
function BattleSide({ side, team, standing, drivers = [] }) {
    const assets = getTeamAssets(team.constructorId);
    const info = assets.info;

    return (
        <div className={`ex-battle-side ex-battle-side--${side}`} style={{ "--accent": assets.accent }}>
            <div className="ex-battle-carbox">
                <LayeredImage
                    candidates={assets.carCandidates}
                    alt={`${team.name} Formula 1 car`}
                    className="ex-battle-car"
                    fallback={
                        <div className="ex-entity-fallback" aria-hidden="true">
                            <span>{team.name.slice(0, 2).toUpperCase()}</span>
                        </div>
                    }
                />
            </div>
            <span className="ex-battle-name">{team.name}</span>
            <p className="ex-battle-sub">
                {team.nationality}
                {info?.founded ? ` · EST. ${info.founded}` : ""}
                {standing?.position ? ` · P${standing.position}` : ""}
            </p>
            {drivers.length > 0 && (
                <p className="ex-battle-sub">
                    {drivers.map((d) => d.Driver.familyName.toUpperCase()).join(" · ")}
                </p>
            )}
            {info?.championships != null && (
                <div className="ex-battle-champs">
                    <span className="ex-battle-champs-num">{info.championships}</span>
                    <span className="ex-battle-champs-label">Constructor<br />Titles</span>
                </div>
            )}
        </div>
    );
}

function TeamComparison() {
    const [teams, setTeams] = useState([]);
    const [team1Id, setTeam1Id] = useState("");
    const [team2Id, setTeam2Id] = useState("");
    const [year, setYear] = useState("2026");
    const [standings, setStandings] = useState([]);
    const [driverStandings, setDriverStandings] = useState([]);

    const t1 = teams.find((t) => t.constructorId === team1Id);
    const t2 = teams.find((t) => t.constructorId === team2Id);
    const info1 = t1 ? teamInfo[t1.constructorId] : null;
    const info2 = t2 ? teamInfo[t2.constructorId] : null;
    const s1 = standings.find((s) => s.Constructor.constructorId === team1Id);
    const s2 = standings.find((s) => s.Constructor.constructorId === team2Id);

    useEffect(() => {
        fetch(`http://localhost:3000/teams/${year}`)
            .then((res) => res.json())
            .then((data) => setTeams(data));
    }, [year]);

    useEffect(() => {
        fetch(`http://localhost:3000/teams/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setStandings(data));
    }, [year]);

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setDriverStandings(Array.isArray(data) ? data : []))
            .catch(() => setDriverStandings([]));
    }, [year]);

    const driversOf = (constructorId) =>
        driverStandings.filter((d) => d.Constructors?.[0]?.constructorId === constructorId);

    const accent1 = getTeamAssets(team1Id).accent;
    const accent2 = getTeamAssets(team2Id).accent;

    return (
        <div className="ex ex-battle-page">
            <header className="ex-hero">
                <span className="ex-hero-eyebrow">Formula 1 · Constructors</span>
                <h1 className="ex-hero-title">Constructor Battle</h1>
                <p className="ex-hero-sub">Engineering Meets Competition.</p>
                <div className="ex-hero-rule" aria-hidden="true" />

                <div className="ex-controls">
                    <label className="ex-field">
                        <span className="ex-field-label">SEASON</span>
                        <select value={year} onChange={(e) => setYear(e.target.value)}>
                            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </label>
                    <EntitySelect
                        label="GARAGE 1"
                        placeholder="Select constructor"
                        searchPlaceholder="Search constructors…"
                        value={team1Id}
                        onChange={setTeam1Id}
                        options={teams}
                        getId={(t) => t.constructorId}
                        getLabel={(t) => t.name}
                        getSubLabel={(t) => t.nationality}
                    />
                    <EntitySelect
                        label="GARAGE 2"
                        placeholder="Select constructor"
                        searchPlaceholder="Search constructors…"
                        value={team2Id}
                        onChange={setTeam2Id}
                        options={teams}
                        getId={(t) => t.constructorId}
                        getLabel={(t) => t.name}
                        getSubLabel={(t) => t.nationality}
                    />
                </div>
            </header>

            {!t1 || !t2 ? (
                <main className="ex-main">
                    <div className="ex-empty">
                        <span className="ex-empty-title">Two garages. One benchmark.</span>
                        <span className="ex-empty-sub">
                            SELECT TWO CONSTRUCTORS ABOVE TO BEGIN THE BATTLE
                        </span>
                    </div>
                </main>
            ) : (
                <>
                    {/* ── facing cars ── */}
                    <div className="ex-battle-hero">
                        <BattleSide
                            key={`l-${t1.constructorId}`}
                            side="left"
                            team={t1}
                            standing={s1}
                            drivers={driversOf(t1.constructorId)}
                        />
                        <div className="ex-w2w-center">
                            <span className="ex-w2w-vs">VS</span>
                            <span className="ex-w2w-season">{year} SEASON</span>
                        </div>
                        <BattleSide
                            key={`r-${t2.constructorId}`}
                            side="right"
                            team={t2}
                            standing={s2}
                            drivers={driversOf(t2.constructorId)}
                        />
                    </div>

                    <main className="ex-main">
                        <ExSection eyebrow="Telemetry" title={`${year} Season`}>
                            <div className="ex-duel-block">
                                <DuelMeter
                                    label="Championship Position"
                                    val1={s1?.position}
                                    val2={s2?.position}
                                    lowerIsBetter
                                    accent1={accent1}
                                    accent2={accent2}
                                />
                                <DuelMeter
                                    label="Points"
                                    val1={s1?.points}
                                    val2={s2?.points}
                                    accent1={accent1}
                                    accent2={accent2}
                                />
                                <DuelMeter
                                    label="Race Wins"
                                    val1={s1?.wins}
                                    val2={s2?.wins}
                                    accent1={accent1}
                                    accent2={accent2}
                                />
                            </div>
                        </ExSection>

                        <ExSection eyebrow="Legacy" title="All-Time Record">
                            <div className="ex-duel-block">
                                <DuelMeter
                                    label="Constructors' Championships"
                                    val1={info1?.championships}
                                    val2={info2?.championships}
                                    accent1={accent1}
                                    accent2={accent2}
                                />
                                <DuelMeter
                                    label="Years in Formula 1"
                                    val1={info1?.founded ? new Date().getFullYear() - info1.founded : null}
                                    val2={info2?.founded ? new Date().getFullYear() - info2.founded : null}
                                    accent1={accent1}
                                    accent2={accent2}
                                />
                            </div>
                        </ExSection>

                        <ExSection eyebrow="Technical File" title="The Organisations">
                            <div className="ex-battle-cols">
                                <div className="ex-battle-col" style={{ "--accent": accent1 }}>
                                    <div className="ex-battle-col-team">{t1.name}</div>
                                    <div className="ex-spec" style={{ border: "none", background: "transparent" }}>
                                        {info1?.engineSupplier && (
                                            <div className="ex-spec-row">
                                                <span className="ex-spec-label">Power Unit</span>
                                                <span className="ex-spec-value">{info1.engineSupplier}</span>
                                            </div>
                                        )}
                                        {info1?.headquarters && (
                                            <div className="ex-spec-row">
                                                <span className="ex-spec-label">Factory</span>
                                                <span className="ex-spec-value">{info1.headquarters}</span>
                                            </div>
                                        )}
                                        {info1?.teamPrincipal && (
                                            <div className="ex-spec-row">
                                                <span className="ex-spec-label">Team Principal</span>
                                                <span className="ex-spec-value">{info1.teamPrincipal}</span>
                                            </div>
                                        )}
                                        {driversOf(t1.constructorId).map((d) => (
                                            <div className="ex-spec-row" key={d.Driver.driverId}>
                                                <span className="ex-spec-label">
                                                    Driver #{d.Driver.permanentNumber}
                                                </span>
                                                <span className="ex-spec-value">
                                                    {d.Driver.givenName} {d.Driver.familyName} · {d.points} PTS
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="ex-battle-col" style={{ "--accent": accent2 }}>
                                    <div className="ex-battle-col-team">{t2.name}</div>
                                    <div className="ex-spec" style={{ border: "none", background: "transparent" }}>
                                        {info2?.engineSupplier && (
                                            <div className="ex-spec-row">
                                                <span className="ex-spec-label">Power Unit</span>
                                                <span className="ex-spec-value">{info2.engineSupplier}</span>
                                            </div>
                                        )}
                                        {info2?.headquarters && (
                                            <div className="ex-spec-row">
                                                <span className="ex-spec-label">Factory</span>
                                                <span className="ex-spec-value">{info2.headquarters}</span>
                                            </div>
                                        )}
                                        {info2?.teamPrincipal && (
                                            <div className="ex-spec-row">
                                                <span className="ex-spec-label">Team Principal</span>
                                                <span className="ex-spec-value">{info2.teamPrincipal}</span>
                                            </div>
                                        )}
                                        {driversOf(t2.constructorId).map((d) => (
                                            <div className="ex-spec-row" key={d.Driver.driverId}>
                                                <span className="ex-spec-label">
                                                    Driver #{d.Driver.permanentNumber}
                                                </span>
                                                <span className="ex-spec-value">
                                                    {d.Driver.givenName} {d.Driver.familyName} · {d.points} PTS
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </ExSection>

                        {(info1?.strategyStyle || info2?.strategyStyle) && (
                            <ExSection eyebrow="Pit Wall" title="Strategy Style">
                                <div className="ex-battle-cols">
                                    <div className="ex-battle-col" style={{ "--accent": accent1 }}>
                                        <div className="ex-battle-col-team">{t1.name}</div>
                                        <p className="ex-prose">{info1?.strategyStyle ?? "—"}</p>
                                    </div>
                                    <div className="ex-battle-col" style={{ "--accent": accent2 }}>
                                        <div className="ex-battle-col-team">{t2.name}</div>
                                        <p className="ex-prose">{info2?.strategyStyle ?? "—"}</p>
                                    </div>
                                </div>
                            </ExSection>
                        )}
                    </main>
                </>
            )}
        </div>
    );
}

export default TeamComparison;
