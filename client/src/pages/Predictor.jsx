/*
 * RACE PREDICTOR — reads GET /api/predictor/upcoming (see server/services/
 * predictorService.js for the actual prediction engine: a weighted
 * power-ranking converted to probabilities via a Plackett-Luce Monte
 * Carlo simulation). This page only renders that response — no
 * prediction math happens here, and nothing is fetched more than once
 * per page load (this isn't a live feature; see Part 28 of the brief).
 * Every number shown traces directly to a field in the real API
 * response; where Phase 12 doesn't provide something (a training
 * period, weather, tyre strategy), it's left out rather than invented.
 */
import { Fragment, useEffect, useState } from "react";
import { Button, EmptyState, LoadingSpinner } from "../components/UI";
import { getTeamAccent } from "../config/driverAssets";
import "../styles/pages/Predictor.css";

const API = "http://localhost:3000";

const FACTOR_LABELS = {
    recentForm: "Recent Form",
    qualifying: "Qualifying",
    constructorStrength: "Constructor",
    circuitHistory: "Circuit History",
    championshipPosition: "Championship",
};

const DATA_USED_ROWS = [
    ["historicalStandings", "Current championship standings"],
    ["recentForm", "Recent race form"],
    ["qualifying", "Qualifying performance"],
    ["circuitHistory", "Circuit history"],
];

function scoreLabel(score) {
    if (score === null || score === undefined) return "—";
    if (score >= 0.85) return "Very Strong";
    if (score >= 0.65) return "Strong";
    if (score >= 0.45) return "Moderate";
    if (score >= 0.25) return "Weak";
    return "Very Weak";
}

function pct(n) {
    return n === null || n === undefined ? "—" : `${Math.round(n * 1000) / 10}%`;
}

function formatDate(dateStr, withWeekday = true) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { weekday: withWeekday ? "short" : undefined, day: "numeric", month: "short", year: "numeric" });
}

function formatTimestamp(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatCountdown(dateStr) {
    if (!dateStr) return null;
    // Race date from Jolpica has no time component here, so this counts
    // down to the start of that calendar day (UTC) — a day-level
    // countdown, not a to-the-minute one.
    const diffMs = new Date(`${dateStr}T00:00:00Z`).getTime() - Date.now();
    if (Number.isNaN(diffMs) || diffMs <= 0) return null;
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
}

/* ── Data hook — fetch once, manual retry only, never polled ─────────── */

function usePrediction() {
    const [state, setState] = useState({ loading: true, error: false, data: null });

    const fetchPrediction = () => {
        fetch(`${API}/api/predictor/upcoming`)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad status"))))
            .then((data) => setState({ loading: false, error: false, data }))
            .catch(() => setState({ loading: false, error: true, data: null }));
    };

    // Initial state already has loading: true, so the effect can fetch
    // directly — no synchronous setState needed before it.
    useEffect(fetchPrediction, []);

    const retry = () => {
        setState({ loading: true, error: false, data: null });
        fetchPrediction();
    };

    return { ...state, retry };
}

/* ── Header ────────────────────────────────────────────────────────── */

function PredictorHeader({ race, generatedAt }) {
    const countdown = formatCountdown(race.date);
    return (
        <header className="pr-header">
            <div className="pr-header-inner">
                <span className="pr-eyebrow">Predictor</span>
                <h1 className="pr-header-gp">{race.name}</h1>
                <p className="pr-header-loc">{race.circuit}{race.country ? `, ${race.country}` : ""}</p>
                <div className="pr-header-meta">
                    <span className="pr-meta-item pr-mono">{formatDate(race.date)}</span>
                    {countdown && <span className="pr-meta-item pr-countdown pr-mono">{countdown}</span>}
                    {race.hasSprint && <span className="pr-meta-item pr-sprint-tag">Sprint Weekend</span>}
                    {generatedAt && (
                        <span className="pr-meta-item pr-meta-item--faint pr-mono">Prediction generated {formatTimestamp(generatedAt)}</span>
                    )}
                </div>
            </div>
        </header>
    );
}

/* ── Prediction status banner ─────────────────────────────────────── */

function PredictionStatus({ stage, race }) {
    const isPost = stage === "post_qualifying";
    return (
        <div className={`pr-status${isPost ? " pr-status--post" : ""}`}>
            <span className="pr-status-label">{isPost ? "Post-Qualifying" : "Pre-Qualifying"}</span>
            <p className="pr-status-desc">
                {isPost
                    ? `Updated using qualifying results${race.qualifyingDate ? ` from ${formatDate(race.qualifyingDate, false)}` : ""}.`
                    : "Qualifying results aren't available yet. This prediction uses historical performance, current-season form, circuit history, and constructor strength."}
            </p>
        </div>
    );
}

/* ── Prediction summary ───────────────────────────────────────────── */

function PredictionSummary({ winner }) {
    if (!winner) return null;
    return (
        <div className="pr-summary" style={{ "--pr-team-color": getTeamAccent(winner.constructorId) }}>
            <span className="pr-panel-title">Predicted Winner</span>
            <div className="pr-summary-body">
                <span className="pr-team-bar" aria-hidden="true" />
                <div className="pr-summary-id">
                    <span className="pr-summary-name">{winner.driverName}</span>
                    <span className="pr-summary-team">{winner.constructor}</span>
                </div>
                <div className="pr-summary-prob">
                    <span className="pr-mono pr-summary-prob-value">{pct(winner.winProbability)}</span>
                    <span className="pr-summary-prob-label">Win Probability</span>
                </div>
            </div>
        </div>
    );
}

/* ── Podium ────────────────────────────────────────────────────────── */

function PredictedPodium({ predictions }) {
    const podium = predictions.slice(0, 3);
    return (
        <div className="pr-podium">
            {podium.map((p) => (
                <div className="pr-podium-card" key={p.driverId} style={{ "--pr-team-color": getTeamAccent(p.constructorId) }}>
                    <span className="pr-mono pr-podium-pos">P{p.predictedPosition}</span>
                    <span className="pr-podium-name">{p.driverName}</span>
                    <span className="pr-podium-team">{p.constructor}</span>
                    <span className="pr-mono pr-podium-prob">{pct(p.podiumProbability)} <small>podium</small></span>
                </div>
            ))}
        </div>
    );
}

/* ── Full classification table with expandable rows ───────────────── */

function ProbabilityBar({ value }) {
    return (
        <span className="pr-bar" role="presentation">
            <span className="pr-bar-fill" style={{ width: `${Math.max(2, (value ?? 0) * 100)}%` }} />
        </span>
    );
}

function DriverDetailPanel({ prediction }) {
    return (
        <div className="pr-detail" id={`pr-detail-${prediction.driverId}`}>
            <div className="pr-detail-grid">
                <div className="pr-detail-stat"><span>{pct(prediction.winProbability)}</span><small>Win</small></div>
                <div className="pr-detail-stat"><span>{pct(prediction.podiumProbability)}</span><small>Podium</small></div>
                <div className="pr-detail-stat"><span>{pct(prediction.top5Probability)}</span><small>Top 5</small></div>
                <div className="pr-detail-stat"><span>{pct(prediction.top10Probability)}</span><small>Top 10</small></div>
                <div className="pr-detail-stat"><span>{prediction.expectedFinish}</span><small>Expected Finish</small></div>
                <div className="pr-detail-stat"><span>{prediction.confidence?.toUpperCase() ?? "—"}</span><small>Confidence</small></div>
            </div>
            <div className="pr-detail-factors">
                {Object.entries(FACTOR_LABELS).map(([key, label]) => {
                    const factor = prediction.factors?.[key];
                    return (
                        <div className="pr-factor-row" key={key}>
                            <span className="pr-factor-label">{label}</span>
                            {factor?.available ? (
                                <>
                                    <ProbabilityBar value={factor.score} />
                                    <span className="pr-mono pr-factor-value">{scoreLabel(factor.score)}</span>
                                </>
                            ) : (
                                <span className="pr-factor-unavailable">Not available</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ClassificationTable({ predictions }) {
    const [expanded, setExpanded] = useState(null);

    return (
        <div className="pr-timing-scroll">
            <table className="pr-table">
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Driver</th>
                        <th>Team</th>
                        <th>Exp. Finish</th>
                        <th>Win</th>
                        <th>Podium</th>
                        <th>Top 5</th>
                        <th>Top 10</th>
                        <th>Confidence</th>
                    </tr>
                </thead>
                <tbody>
                    {predictions.map((p) => {
                        const isOpen = expanded === p.driverId;
                        return (
                            <Fragment key={p.driverId}>
                                <tr
                                    className={`pr-row${isOpen ? " pr-row--open" : ""}`}
                                    tabIndex={0}
                                    role="button"
                                    aria-expanded={isOpen}
                                    aria-controls={`pr-detail-${p.driverId}`}
                                    onClick={() => setExpanded(isOpen ? null : p.driverId)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            setExpanded(isOpen ? null : p.driverId);
                                        }
                                    }}
                                >
                                    <td className="pr-mono pr-pos">{p.predictedPosition}</td>
                                    <td>
                                        <span className="pr-driver-chip">
                                            <span className="pr-team-dot" style={{ background: getTeamAccent(p.constructorId) }} aria-hidden="true" />
                                            <span className="pr-driver-code pr-mono">{p.driverCode ?? p.driverId}</span>
                                            <span className="pr-driver-name">{p.driverName}</span>
                                        </span>
                                    </td>
                                    <td className="pr-team-cell">{p.constructor}</td>
                                    <td className="pr-mono">{p.expectedFinish}</td>
                                    <td className="pr-mono">{pct(p.winProbability)}</td>
                                    <td className="pr-mono">{pct(p.podiumProbability)}</td>
                                    <td className="pr-mono">{pct(p.top5Probability)}</td>
                                    <td className="pr-mono">{pct(p.top10Probability)}</td>
                                    <td><span className={`pr-confidence pr-confidence--${p.confidence}`}>{p.confidence?.toUpperCase() ?? "—"}</span></td>
                                </tr>
                                {isOpen && (
                                    <tr className="pr-detail-row">
                                        <td colSpan={9}>
                                            <DriverDetailPanel prediction={p} />
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/* ── Why this prediction (headline explanation, for the predicted winner) ── */

function WhyThisPrediction({ winner }) {
    if (!winner) return null;
    return (
        <div className="pr-why">
            {Object.entries(FACTOR_LABELS).map(([key, label]) => {
                const factor = winner.factors?.[key];
                return (
                    <div className="pr-factor-row" key={key}>
                        <span className="pr-factor-label">{label}</span>
                        {factor?.available ? (
                            <>
                                <ProbabilityBar value={factor.score} />
                                <span className="pr-mono pr-factor-value">{scoreLabel(factor.score)}</span>
                            </>
                        ) : (
                            <span className="pr-factor-unavailable">Not available</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ── Model + data sections ─────────────────────────────────────────── */

function ModelInfo({ model, stage, generatedAt, driverCount }) {
    const rows = [
        ["Model", model?.name ?? "—"],
        ["Version", model?.version ?? "—"],
        ["Prediction Stage", stage === "post_qualifying" ? "Post-Qualifying" : "Pre-Qualifying"],
        ["Drivers Considered", driverCount],
        ["Generated", formatTimestamp(generatedAt) ?? "—"],
    ];
    return (
        <dl className="pr-kv">
            {rows.map(([label, value]) => (
                <div className="pr-kv-row" key={label}>
                    <dt>{label}</dt>
                    <dd className="pr-mono">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

function DataUsed({ dataAvailability }) {
    const unavailable = [
        dataAvailability?.weather === false ? "Weather" : null,
        dataAvailability?.tyreStrategy === false ? "Tyre strategy" : null,
    ].filter(Boolean);

    return (
        <div className="pr-datalist">
            {DATA_USED_ROWS.map(([key, label]) => (
                <div className={`pr-data-row${dataAvailability?.[key] ? "" : " pr-data-row--off"}`} key={key}>
                    <span className="pr-data-mark" aria-hidden="true">{dataAvailability?.[key] ? "✓" : "○"}</span>
                    {label}
                </div>
            ))}
            <div className="pr-data-row">
                <span className="pr-data-mark" aria-hidden="true">✓</span>
                Constructor performance
            </div>
            {unavailable.map((label) => (
                <div className="pr-data-row pr-data-row--off" key={label}>
                    <span className="pr-data-mark" aria-hidden="true">○</span>
                    {label}
                </div>
            ))}
        </div>
    );
}

function DataAvailabilityTable({ dataAvailability }) {
    if (!dataAvailability) return null;
    const labels = {
        historicalData: "Historical data",
        historicalStandings: "Historical data",
        currentSeasonData: "Current season",
        qualifying: "Qualifying",
        circuitHistory: "Circuit history",
        weather: "Weather",
        tyreStrategy: "Tyre strategy",
    };
    const seen = new Set();
    const rows = Object.entries(dataAvailability).filter(([key]) => {
        const label = labels[key];
        if (!label || seen.has(label)) return false;
        seen.add(label);
        return true;
    });

    return (
        <dl className="pr-kv">
            {rows.map(([key, value]) => (
                <div className="pr-kv-row" key={key}>
                    <dt>{labels[key]}</dt>
                    <dd className={value ? "pr-avail-yes" : "pr-avail-no"}>{value ? "Available" : "Unavailable"}</dd>
                </div>
            ))}
        </dl>
    );
}

/* ── Section shell ─────────────────────────────────────────────────── */

function Panel({ title, className = "", children }) {
    return (
        <section className={`pr-panel ${className}`}>
            {title && <h2 className="pr-panel-title">{title}</h2>}
            {children}
        </section>
    );
}

/* ── Page ──────────────────────────────────────────────────────────── */

function Predictor() {
    const { loading, error, data, retry } = usePrediction();

    if (loading) {
        return (
            <div className="pr-loading">
                <LoadingSpinner label="Collecting current F1 data" />
                <p className="pr-loading-title">Preparing race prediction</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="pr">
                <main className="pr-main">
                    <EmptyState
                        title="Prediction unavailable"
                        description="Race prediction could not be generated right now."
                        action={<Button variant="secondary" onClick={retry}>Retry</Button>}
                    />
                </main>
            </div>
        );
    }

    if (!data?.available) {
        const isNoRace = data?.reason === "no_upcoming_race";
        return (
            <div className="pr">
                <main className="pr-main">
                    <EmptyState
                        title={isNoRace ? "No upcoming Grand Prix" : "Prediction unavailable"}
                        description={data?.message ?? "Nothing to predict right now."}
                        action={<Button variant="secondary" onClick={retry}>Retry</Button>}
                    />
                </main>
            </div>
        );
    }

    const { race, stage, generatedAt, model, dataAvailability, predictions, limitations } = data;
    const winner = predictions?.[0] ?? null;

    return (
        <div className="pr">
            <PredictorHeader race={race} generatedAt={generatedAt} />
            <main className="pr-main">
                <PredictionStatus stage={stage} race={race} />
                <PredictionSummary winner={winner} />
                <Panel title="Predicted Podium">
                    <PredictedPodium predictions={predictions} />
                </Panel>
                <Panel title="Predicted Classification" className="pr-panel--full">
                    <ClassificationTable predictions={predictions} />
                </Panel>
                <Panel title="Why This Prediction?">
                    <WhyThisPrediction winner={winner} />
                </Panel>
                <div className="pr-grid pr-grid--split">
                    <Panel title="Model">
                        <ModelInfo model={model} stage={stage} generatedAt={generatedAt} driverCount={predictions.length} />
                    </Panel>
                    <Panel title="Data Used">
                        <DataUsed dataAvailability={dataAvailability} />
                    </Panel>
                </div>
                <Panel title="Data Availability">
                    <DataAvailabilityTable dataAvailability={dataAvailability} />
                </Panel>
                <p className="pr-disclaimer">
                    Predictions are model estimates based on available historical and race-weekend data. They are not guaranteed race outcomes.
                    {limitations?.length > 0 && ` ${limitations[0]}`}
                </p>
            </main>
        </div>
    );
}

export default Predictor;
