import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import teamInfo from "../data/teamInfo";
import ExSection from "../components/entity/ExSection";
import EntitySelect from "../components/entity/EntitySelect";
import TeamDrivers from "../components/entity/TeamDrivers";
import CompareEmptyState from "../components/compare/CompareEmptyState";
import PendingSlot from "../components/compare/PendingSlot";
import CompareStat from "../components/compare/CompareStat";
import CompareBar from "../components/compare/CompareBar";
import RaceTimeline from "../components/compare/RaceTimeline";
import { Select } from "../components/ui/Input";
import useSeasonResults from "../hooks/useSeasonResults";
import { getTeamAssets } from "../config/teamAssets";
import "./EntityPages.css";
import "./Comparison.css";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

const EMPTY_METRICS = [
    "CHAMPIONSHIP",
    "POINTS",
    "RACE WINS",
    "PODIUMS",
    "QUALIFYING",
    "RACE PERFORMANCE",
];

/* logo on a light backing plate — the same "car photography is
   inconsistent, lean on the real logo" decision made on the Constructors
   page, just given more room to read clearly here */
function TeamPlate({ team, assets }) {
    return (
        <div className="cmp-team-plate">
            {assets.logo ? (
                <img src={assets.logo} alt={`${team.name} logo`} className="cmp-team-logo" />
            ) : (
                <span className="cmp-team-fallback" aria-hidden="true">{team.name.slice(0, 3).toUpperCase()}</span>
            )}
        </div>
    );
}

function TeamFace({ side, team, standing }) {
    const assets = getTeamAssets(team.constructorId);
    return (
        <div className={`cmp-face cmp-team-face cmp-face--${side}`}>
            <TeamPlate team={team} assets={assets} />
            <h3 className="cmp-face-name">{team.name}</h3>
            <p className="cmp-face-team">{team.nationality}</p>
            <div className="cmp-team-headline">
                <span className="cmp-team-pos cmp-mono">{standing ? `P${standing.position}` : "—"}</span>
                <span className="cmp-team-pts cmp-mono">{standing ? `${standing.points} PTS` : "—"}</span>
            </div>
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
    const bothSelected = Boolean(t1 && t2);
    const info1 = t1 ? teamInfo[t1.constructorId] : null;
    const info2 = t2 ? teamInfo[t2.constructorId] : null;
    const s1 = standings.find((s) => s.Constructor.constructorId === team1Id);
    const s2 = standings.find((s) => s.Constructor.constructorId === team2Id);

    useEffect(() => {
        fetch(`http://localhost:3000/teams/${year}`)
            .then((res) => res.json())
            .then((data) => setTeams(Array.isArray(data) ? data : []))
            .catch(() => setTeams([]));
    }, [year]);

    useEffect(() => {
        fetch(`http://localhost:3000/teams/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setStandings(Array.isArray(data) ? data : []))
            .catch(() => setStandings([]));
    }, [year]);

    useEffect(() => {
        fetch(`http://localhost:3000/drivers/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setDriverStandings(Array.isArray(data) ? data : []))
            .catch(() => setDriverStandings([]));
    }, [year]);

    const driversOf = (constructorId) =>
        driverStandings.filter((d) => d.Constructors?.[0]?.constructorId === constructorId);

    const { races, resultsByRound, loading: seasonLoading, error: seasonError } =
        useSeasonResults(year, { enabled: bothSelected });

    const rounds = useMemo(
        () => races.filter((r) => resultsByRound[r.round] !== undefined).sort((a, b) => Number(a.round) - Number(b.round)),
        [races, resultsByRound]
    );

    const cellFor = (round, constructorId) => {
        const res = resultsByRound[round] || [];
        const entries = res.filter((x) => x.Constructor.constructorId === constructorId);
        if (!entries.length) return "—";
        return entries.map((e) => `P${e.position}`).join(" + ");
    };

    const timeline = useMemo(() => {
        if (!bothSelected) return [];
        return rounds.map((r) => ({
            round: r.round,
            raceName: r.raceName,
            a: cellFor(r.round, team1Id),
            b: cellFor(r.round, team2Id),
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rounds, team1Id, team2Id, bothSelected]);

    const pointsInRound = (round, constructorId) =>
        (resultsByRound[round] || [])
            .filter((x) => x.Constructor.constructorId === constructorId)
            .reduce((sum, x) => sum + parseFloat(x.points || 0), 0);

    const trendData = useMemo(() => {
        if (!bothSelected) return [];
        let cumA = 0, cumB = 0;
        return rounds.map((r) => {
            cumA += pointsInRound(r.round, team1Id);
            cumB += pointsInRound(r.round, team2Id);
            return { round: `R${r.round}`, [t1.name]: cumA, [t2.name]: cumB };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rounds, team1Id, team2Id, bothSelected]);

    return (
        <div className="ex cmp cmp-team-page">
            <header className="cmp-hero">
                <div className="cmp-hero-inner">
                    <span className="cmp-hero-eyebrow">FORMULA 1 · CONSTRUCTOR HEAD TO HEAD</span>
                    <h1 className="cmp-hero-title">Team vs Team</h1>
                    <p className="cmp-hero-sub">Compare performance across the season.</p>

                    <div className="cmp-controls">
                        <Select label="SEASON" value={year} onChange={(e) => setYear(e.target.value)}>
                            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                        </Select>
                        <EntitySelect
                            label="TEAM 01"
                            placeholder="Select team"
                            searchPlaceholder="Search constructors…"
                            value={team1Id}
                            onChange={setTeam1Id}
                            options={teams}
                            getId={(t) => t.constructorId}
                            getLabel={(t) => t.name}
                            getSubLabel={(t) => t.nationality}
                        />
                        <EntitySelect
                            label="TEAM 02"
                            placeholder="Select team"
                            searchPlaceholder="Search constructors…"
                            value={team2Id}
                            onChange={setTeam2Id}
                            options={teams}
                            getId={(t) => t.constructorId}
                            getLabel={(t) => t.name}
                            getSubLabel={(t) => t.nationality}
                        />
                    </div>
                </div>

                {!bothSelected && (
                    <div className="cmp-stage">
                        {!t1 && !t2 && (
                            <CompareEmptyState
                                eyebrow="GETTING STARTED"
                                title="Select two constructors"
                                description="Compare:"
                                metrics={EMPTY_METRICS}
                            />
                        )}
                        {(t1 || t2) && !bothSelected && (
                            <div className="cmp-partial">
                                {t1 ? <TeamFace side="left" team={t1} standing={s1} /> : <PendingSlot label="Select Team One" />}
                                <span className="cmp-partial-vs cmp-mono">VS</span>
                                {t2 ? <TeamFace side="right" team={t2} standing={s2} /> : <PendingSlot label="Select Team Two" />}
                            </div>
                        )}
                    </div>
                )}
            </header>

            {bothSelected && (
                <>
                    <section className="cmp-band cmp-band--dark cmp-band--tech">
                        <div className="cmp-band-inner">
                            <span className="cmp-tech-kicker cmp-mono">SPEC COMPARISON · {year}</span>
                            <div className="cmp-faceoff cmp-team-faceoff">
                                <TeamFace key={`l-${t1.constructorId}`} side="left" team={t1} standing={s1} />
                                <div className="cmp-faceoff-center">
                                    <span className="cmp-faceoff-vs cmp-mono">VS</span>
                                    <span className="cmp-faceoff-season cmp-mono">{year} SEASON</span>
                                </div>
                                <TeamFace key={`r-${t2.constructorId}`} side="right" team={t2} standing={s2} />
                            </div>

                            <ExSection eyebrow="Telemetry" title="Championship Comparison">
                                <div className="cmp-grid">
                                    <CompareStat label="Championship Position" prefix="P" valueA={s1?.position} valueB={s2?.position} lowerIsBetter />
                                    <CompareBar label="Points" a={{ name: t1.name, value: s1?.points }} b={{ name: t2.name, value: s2?.points }} />
                                    <CompareBar label="Race Wins" a={{ name: t1.name, value: s1?.wins }} b={{ name: t2.name, value: s2?.wins }} />
                                    <CompareBar
                                        label="Constructors' Championships"
                                        a={{ name: t1.name, value: info1?.championships }}
                                        b={{ name: t2.name, value: info2?.championships }}
                                    />
                                </div>
                            </ExSection>
                        </div>
                    </section>

                    <section className="cmp-band cmp-band--light">
                        <div className="cmp-band-inner">
                            <header className="cmp-band-head">
                                <span className="cmp-band-eyebrow">Current Line-Up</span>
                                <h2 className="cmp-band-title">Driver Pairing</h2>
                            </header>
                            <div className="cmp-lineup">
                                <div className="cmp-lineup-col">
                                    <span className="cmp-lineup-team">{t1.name}</span>
                                    <TeamDrivers drivers={driversOf(t1.constructorId)} year={year} />
                                </div>
                                <span className="cmp-partial-vs cmp-mono">VS</span>
                                <div className="cmp-lineup-col cmp-lineup-col--b">
                                    <span className="cmp-lineup-team">{t2.name}</span>
                                    <TeamDrivers drivers={driversOf(t2.constructorId)} year={year} />
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="cmp-band cmp-band--dark cmp-band--tech">
                        <div className="cmp-band-inner">
                            <span className="cmp-tech-kicker cmp-mono">SESSION LOG · ROUND BY ROUND</span>
                            <header className="cmp-band-head cmp-band-head--dark">
                                <h2 className="cmp-band-title cmp-band-title--dark">{year} Race-by-Race Performance</h2>
                            </header>
                            <RaceTimeline
                                rows={timeline}
                                loading={seasonLoading}
                                error={seasonError}
                                labelA={t1.name}
                                labelB={t2.name}
                            />
                        </div>
                    </section>

                    {trendData.length >= 2 && (
                        <section className="cmp-band cmp-band--light">
                            <div className="cmp-band-inner">
                                <header className="cmp-band-head">
                                    <span className="cmp-band-eyebrow">Performance Trend</span>
                                    <h2 className="cmp-band-title">Cumulative Points</h2>
                                </header>
                                <div className="cmp-chart">
                                    <ResponsiveContainer width="100%" height={280}>
                                        <LineChart data={trendData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                                            <CartesianGrid stroke="var(--border-on-light)" vertical={false} />
                                            <XAxis dataKey="round" stroke="var(--text-on-light-muted)" fontSize={11} fontFamily="var(--font-mono)" tickLine={false} axisLine={false} />
                                            <YAxis stroke="var(--text-on-light-muted)" fontSize={11} fontFamily="var(--font-mono)" tickLine={false} axisLine={false} width={36} />
                                            <Tooltip
                                                contentStyle={{ background: "var(--surface-light-1)", border: "1px solid var(--border-on-light-strong)", borderRadius: 8, fontSize: 12 }}
                                            />
                                            <Line type="monotone" dataKey={t1.name} stroke="#191919" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey={t2.name} stroke="#B0080B" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                    <div className="cmp-chart-legend">
                                        <span className="cmp-chart-legend-item"><i style={{ background: "#191919" }} />{t1.name}</span>
                                        <span className="cmp-chart-legend-item"><i style={{ background: "#B0080B" }} />{t2.name}</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    <main className="ex-main">
                        {(info1?.strategyStyle || info2?.strategyStyle) && (
                            <ExSection eyebrow="Pit Wall" title="Strategy Style">
                                <div className="ex-cols">
                                    <div className="ex-spec">
                                        {info1?.engineSupplier && <div className="ex-spec-row"><span className="ex-spec-label">Power Unit</span><span className="ex-spec-value">{info1.engineSupplier}</span></div>}
                                        {info1?.headquarters && <div className="ex-spec-row"><span className="ex-spec-label">Factory</span><span className="ex-spec-value">{info1.headquarters}</span></div>}
                                        {info1?.teamPrincipal && <div className="ex-spec-row"><span className="ex-spec-label">Team Principal</span><span className="ex-spec-value">{info1.teamPrincipal}</span></div>}
                                        {info1?.strategyStyle && <p className="ex-prose" style={{ marginTop: 16 }}>{info1.strategyStyle}</p>}
                                    </div>
                                    <div className="ex-spec">
                                        {info2?.engineSupplier && <div className="ex-spec-row"><span className="ex-spec-label">Power Unit</span><span className="ex-spec-value">{info2.engineSupplier}</span></div>}
                                        {info2?.headquarters && <div className="ex-spec-row"><span className="ex-spec-label">Factory</span><span className="ex-spec-value">{info2.headquarters}</span></div>}
                                        {info2?.teamPrincipal && <div className="ex-spec-row"><span className="ex-spec-label">Team Principal</span><span className="ex-spec-value">{info2.teamPrincipal}</span></div>}
                                        {info2?.strategyStyle && <p className="ex-prose" style={{ marginTop: 16 }}>{info2.strategyStyle}</p>}
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
