import { useState, useEffect, useMemo } from "react";
import driverInfo from "../data/driverInfo";
import { KnowMoreModal, KnowMoreTerm } from "../components/KnowMore";
import { knowMoreInfo } from "../data/knowMoreInfo";
import { LayeredImage, ExSection } from "../components/EntityDetail";
import { EntitySelect, CompareEmptyState, PendingSlot, CompareStat, CompareBar, RaceTimeline } from "../components/Compare";
import { Select } from "../components/UI";
import useSeasonResults from "../hooks/useSeasonResults";
import { getDriverAssets } from "../config/driverAssets";
import "../styles/pages/EntityPages.css";
import "../styles/pages/Comparison.css";
import { API_BASE_URL as API } from "../config/api";

const YEARS = ["2020", "2021", "2022", "2023", "2024", "2025", "2026"];

const EMPTY_METRICS = [
    "CHAMPIONSHIP POSITION",
    "POINTS",
    "RACE WINS",
    "PODIUMS",
    "QUALIFYING",
    "RACE RESULTS",
    "CAREER RECORD",
];

/* the exact image treatment established on the Drivers page — same
   aspect ratio, crop and fallback, via the shared .dc-media/.dc-img/
   .dc-ghost classes so the two portraits always visually belong together */
function DriverPlate({ driver }) {
    const fullName = `${driver.givenName} ${driver.familyName}`;
    const assets = getDriverAssets(driver.driverId, fullName);
    return (
        <div className="dc-media cmp-plate">
            <LayeredImage
                candidates={assets.imageCandidates}
                alt={fullName}
                className="dc-img"
                fallback={<span className="dc-ghost" aria-hidden="true">{driver.permanentNumber ?? "—"}</span>}
            />
        </div>
    );
}

function DriverFace({ side, driver, standing }) {
    const team = standing?.Constructors?.[0];
    return (
        <div className={`cmp-face cmp-face--${side}`}>
            <span className="cmp-face-num cmp-mono" aria-hidden="true">{driver.permanentNumber ?? "—"}</span>
            <DriverPlate driver={driver} />
            <h3 className="cmp-face-name">
                <span className="cmp-face-given">{driver.givenName}</span>
                <b className="cmp-face-family">{driver.familyName}</b>
            </h3>
            <p className="cmp-face-team">{team?.name ?? "—"}</p>
            <p className="cmp-face-nat cmp-mono">{driver.nationality}</p>
        </div>
    );
}

/* The closing statistical summary — directly counted from round-by-round
   results, never a subjective "overall winner". Ties are shown as their
   own real number rather than being forced onto one side. Only used on
   this page, so it lives here rather than in components/. */
function HeadToHeadTally({ label, unit, a, b, ties }) {
    return (
        <div className="cmp-h2h-row">
            <span className="cmp-h2h-label">{label}</span>
            <div className="cmp-h2h-cols">
                <div className="cmp-h2h-col">
                    <span className="cmp-h2h-name">{a.name}</span>
                    <span className="cmp-h2h-count">{a.count} {unit}</span>
                </div>
                <div className="cmp-h2h-col cmp-h2h-col--b">
                    <span className="cmp-h2h-name">{b.name}</span>
                    <span className="cmp-h2h-count">{b.count} {unit}</span>
                </div>
            </div>
            {ties > 0 && <span className="cmp-h2h-ties">{ties} equal result{ties === 1 ? "" : "s"}</span>}
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
    const bothSelected = Boolean(d1 && d2);
    const info1 = d1 ? driverInfo[`${d1.givenName} ${d1.familyName}`] : null;
    const info2 = d2 ? driverInfo[`${d2.givenName} ${d2.familyName}`] : null;
    const s1 = standings.find((s) => s.Driver.driverId === driver1);
    const s2 = standings.find((s) => s.Driver.driverId === driver2);

    useEffect(() => {
        fetch(`${API}/drivers/${year}`)
            .then((res) => res.json())
            .then((data) => setDrivers(Array.isArray(data) ? data : []))
            .catch(() => setDrivers([]));
    }, [year]);

    useEffect(() => {
        fetch(`${API}/drivers/standings/${year}`)
            .then((res) => res.json())
            .then((data) => setStandings(Array.isArray(data) ? data : []))
            .catch(() => setStandings([]));
    }, [year]);

    const { races, resultsByRound, qualifyingByRound, loading: seasonLoading, error: seasonError } =
        useSeasonResults(year, { includeQualifying: true, enabled: bothSelected });

    /* round-by-round rows for the two selected drivers, built once from
       the same results/qualifying data already fetched for the timeline —
       reused below for every derived season statistic */
    const timeline = useMemo(() => {
        if (!bothSelected) return [];
        return races
            .filter((r) => resultsByRound[r.round] !== undefined)
            .map((r) => {
                const res = resultsByRound[r.round] || [];
                const r1 = res.find((x) => x.Driver.driverId === driver1) || null;
                const r2 = res.find((x) => x.Driver.driverId === driver2) || null;
                const q = qualifyingByRound[r.round] || [];
                const q1 = q.find((x) => x.Driver.driverId === driver1) || null;
                const q2 = q.find((x) => x.Driver.driverId === driver2) || null;
                return {
                    round: r.round,
                    raceName: r.raceName,
                    a: r1 ? `P${r1.position}` : "—",
                    b: r2 ? `P${r2.position}` : "—",
                    r1, r2, q1, q2,
                };
            })
            .sort((a, b) => Number(a.round) - Number(b.round));
    }, [races, resultsByRound, qualifyingByRound, bothSelected, driver1, driver2]);

    const average = (rows) => (rows.length ? (rows.reduce((s, n) => s + n, 0) / rows.length).toFixed(1) : null);

    const avgFinishA = average(timeline.filter((r) => r.r1).map((r) => parseFloat(r.r1.position)));
    const avgFinishB = average(timeline.filter((r) => r.r2).map((r) => parseFloat(r.r2.position)));
    const avgQualiA = average(timeline.filter((r) => r.q1).map((r) => parseFloat(r.q1.position)));
    const avgQualiB = average(timeline.filter((r) => r.q2).map((r) => parseFloat(r.q2.position)));

    const h2h = useMemo(() => {
        let raceA = 0, raceB = 0, raceTies = 0;
        let qualiA = 0, qualiB = 0, qualiTies = 0;
        timeline.forEach((row) => {
            if (row.r1 && row.r2) {
                const p1 = parseFloat(row.r1.position), p2 = parseFloat(row.r2.position);
                if (!Number.isNaN(p1) && !Number.isNaN(p2)) {
                    if (p1 < p2) raceA += 1; else if (p2 < p1) raceB += 1; else raceTies += 1;
                }
            }
            if (row.q1 && row.q2) {
                const p1 = parseFloat(row.q1.position), p2 = parseFloat(row.q2.position);
                if (!Number.isNaN(p1) && !Number.isNaN(p2)) {
                    if (p1 < p2) qualiA += 1; else if (p2 < p1) qualiB += 1; else qualiTies += 1;
                }
            }
        });
        return { raceA, raceB, raceTies, qualiA, qualiB, qualiTies };
    }, [timeline]);

    return (
        <div className="ex cmp cmp-driver-page">
            <header className="cmp-hero">
                <div className="cmp-hero-inner">
                    <span className="cmp-hero-eyebrow">FORMULA 1 · HEAD TO HEAD</span>
                    <h1 className="cmp-hero-title">Wheel to Wheel</h1>
                    <p className="cmp-hero-sub">Two drivers. One comparison. Every statistic, every result, every advantage.</p>

                    <div className="cmp-controls">
                        <Select label="SEASON" value={year} onChange={(e) => setYear(e.target.value)}>
                            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                        </Select>
                        <EntitySelect
                            label="DRIVER 01"
                            placeholder="Select driver"
                            searchPlaceholder="Search drivers…"
                            value={driver1}
                            onChange={setDriver1}
                            options={drivers}
                            getId={(d) => d.driverId}
                            getLabel={(d) => `${d.givenName} ${d.familyName}`}
                            getSubLabel={(d) =>
                                standings.find((s) => s.Driver.driverId === d.driverId)?.Constructors?.[0]?.name ?? d.nationality
                            }
                        />
                        <EntitySelect
                            label="DRIVER 02"
                            placeholder="Select driver"
                            searchPlaceholder="Search drivers…"
                            value={driver2}
                            onChange={setDriver2}
                            options={drivers}
                            getId={(d) => d.driverId}
                            getLabel={(d) => `${d.givenName} ${d.familyName}`}
                            getSubLabel={(d) =>
                                standings.find((s) => s.Driver.driverId === d.driverId)?.Constructors?.[0]?.name ?? d.nationality
                            }
                        />
                    </div>
                </div>

                {!bothSelected && (
                    <div className="cmp-stage">
                        {!d1 && !d2 && (
                            <CompareEmptyState
                                eyebrow="GETTING STARTED"
                                title="Build your head-to-head"
                                description="Select two drivers above to compare:"
                                metrics={EMPTY_METRICS}
                            />
                        )}
                        {(d1 || d2) && !bothSelected && (
                            <div className="cmp-partial">
                                {d1 ? <DriverFace side="left" driver={d1} standing={s1} /> : <PendingSlot label="Select Driver One" />}
                                <span className="cmp-partial-vs cmp-mono">VS</span>
                                {d2 ? <DriverFace side="right" driver={d2} standing={s2} /> : <PendingSlot label="Select Driver Two" />}
                            </div>
                        )}
                    </div>
                )}
            </header>

            {bothSelected && (
                <>
                    <section className="cmp-band cmp-band--dark cmp-faceoff-band">
                        <div className="cmp-faceoff">
                            <DriverFace key={`l-${d1.driverId}`} side="left" driver={d1} standing={s1} />
                            <div className="cmp-faceoff-center">
                                <span className="cmp-faceoff-vs cmp-mono">VS</span>
                                <span className="cmp-faceoff-season cmp-mono">{year} SEASON</span>
                            </div>
                            <DriverFace key={`r-${d2.driverId}`} side="right" driver={d2} standing={s2} />
                        </div>
                    </section>

                    <main className="ex-main">
                        <ExSection eyebrow="Telemetry" title={`${year} Championship`}>
                            <div className="cmp-grid">
                                <CompareStat
                                    label={<KnowMoreTerm term="championship_leader" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Championship Position</KnowMoreTerm>}
                                    prefix="P"
                                    valueA={s1?.position}
                                    valueB={s2?.position}
                                    lowerIsBetter
                                />
                                <CompareBar
                                    label={<KnowMoreTerm term="points_system" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Points</KnowMoreTerm>}
                                    a={{ name: d1.familyName, value: s1?.points }}
                                    b={{ name: d2.familyName, value: s2?.points }}
                                />
                                <CompareBar
                                    label="Race Wins"
                                    a={{ name: d1.familyName, value: s1?.wins }}
                                    b={{ name: d2.familyName, value: s2?.wins }}
                                />
                            </div>
                        </ExSection>

                        <ExSection eyebrow="One Lap vs Race Distance" title="Qualifying vs Race">
                            <div className="cmp-grid">
                                <CompareStat
                                    label="Average Qualifying Position"
                                    prefix="P"
                                    valueA={avgQualiA}
                                    valueB={avgQualiB}
                                    lowerIsBetter
                                />
                                <CompareStat
                                    label="Average Race Finish"
                                    prefix="P"
                                    valueA={avgFinishA}
                                    valueB={avgFinishB}
                                    lowerIsBetter
                                />
                            </div>
                        </ExSection>

                        <ExSection eyebrow="The Long Game" title="Career Record">
                            <div className="cmp-grid">
                                <CompareBar
                                    label={<KnowMoreTerm term="drivers_championship" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Championships</KnowMoreTerm>}
                                    a={{ name: d1.familyName, value: info1?.championships }}
                                    b={{ name: d2.familyName, value: info2?.championships }}
                                />
                                <CompareBar
                                    label="Career Race Wins"
                                    a={{ name: d1.familyName, value: info1?.raceWins }}
                                    b={{ name: d2.familyName, value: info2?.raceWins }}
                                />
                                <CompareBar
                                    label={<KnowMoreTerm term="podium" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Podiums</KnowMoreTerm>}
                                    a={{ name: d1.familyName, value: info1?.podiums }}
                                    b={{ name: d2.familyName, value: info2?.podiums }}
                                />
                                <CompareBar
                                    label={<KnowMoreTerm term="pole_position" setSelectedTerm={setSelectedTerm} knowMoreInfo={knowMoreInfo}>Pole Positions</KnowMoreTerm>}
                                    a={{ name: d1.familyName, value: info1?.polePositions }}
                                    b={{ name: d2.familyName, value: info2?.polePositions }}
                                />
                            </div>
                        </ExSection>
                    </main>

                    <section className="cmp-band cmp-band--light">
                        <div className="cmp-band-inner">
                            <header className="cmp-band-head">
                                <span className="cmp-band-eyebrow">Round by Round</span>
                                <h2 className="cmp-band-title">{year} Season Results</h2>
                            </header>
                            <RaceTimeline
                                rows={timeline}
                                loading={seasonLoading}
                                error={seasonError}
                                labelA={d1.familyName}
                                labelB={d2.familyName}
                            />
                        </div>
                    </section>

                    <main className="ex-main">
                        <ExSection eyebrow="The Numbers" title="Head-to-Head Result">
                            <div className="cmp-h2h">
                                <HeadToHeadTally
                                    label="Race Finishes"
                                    unit="better finishes"
                                    a={{ name: d1.familyName, count: h2h.raceA }}
                                    b={{ name: d2.familyName, count: h2h.raceB }}
                                    ties={h2h.raceTies}
                                />
                                <HeadToHeadTally
                                    label="Qualifying"
                                    unit="better qualifying results"
                                    a={{ name: d1.familyName, count: h2h.qualiA }}
                                    b={{ name: d2.familyName, count: h2h.qualiB }}
                                    ties={h2h.qualiTies}
                                />
                            </div>
                        </ExSection>

                        <ExSection eyebrow="Credentials" title="Driver Profile">
                            <div className="ex-cols">
                                <div className="ex-spec">
                                    <div className="ex-spec-row"><span className="ex-spec-label">Nationality</span><span className="ex-spec-value">{d1.nationality}</span></div>
                                    <div className="ex-spec-row"><span className="ex-spec-label">Date of Birth</span><span className="ex-spec-value">{d1.dateOfBirth}</span></div>
                                    <div className="ex-spec-row"><span className="ex-spec-label">Driver Code</span><span className="ex-spec-value">{d1.code}</span></div>
                                    <div className="ex-spec-row"><span className="ex-spec-label">F1 Debut</span><span className="ex-spec-value">{info1?.debut ?? "—"}</span></div>
                                    <div className="ex-spec-row"><span className="ex-spec-label">Best Season</span><span className="ex-spec-value">{info1?.bestSeason ?? "—"}</span></div>
                                </div>
                                <div className="ex-spec">
                                    <div className="ex-spec-row"><span className="ex-spec-label">Nationality</span><span className="ex-spec-value">{d2.nationality}</span></div>
                                    <div className="ex-spec-row"><span className="ex-spec-label">Date of Birth</span><span className="ex-spec-value">{d2.dateOfBirth}</span></div>
                                    <div className="ex-spec-row"><span className="ex-spec-label">Driver Code</span><span className="ex-spec-value">{d2.code}</span></div>
                                    <div className="ex-spec-row"><span className="ex-spec-label">F1 Debut</span><span className="ex-spec-value">{info2?.debut ?? "—"}</span></div>
                                    <div className="ex-spec-row"><span className="ex-spec-label">Best Season</span><span className="ex-spec-value">{info2?.bestSeason ?? "—"}</span></div>
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
