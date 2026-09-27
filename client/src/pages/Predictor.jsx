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
import { CheckCircle2, Clock, Info, Circle, CloudSun, Thermometer, Droplets, Wind, BarChart3, History } from "lucide-react";
import { Button, EmptyState, LoadingSpinner } from "../components/UI";
import { getTeamAccent } from "../config/driverAssets";
import "../styles/pages/Predictor.css";
import { API_BASE_URL as API } from "../config/api";


const FACTOR_LABELS = {
    recentForm: "Recent Form",
    qualifying: "Qualifying",
    constructorStrength: "Constructor",
    circuitHistory: "Circuit History",
    championshipPosition: "Championship",
};

/* Prose phrasing for the same five factors, for the "Why This Prediction?"
   intro sentence — FACTOR_LABELS above is tuned for a compact label next
   to a score bar, not for reading naturally in a sentence. */
const FACTOR_PROSE = {
    championshipPosition: "current championship position",
    recentForm: "recent race form",
    qualifying: "qualifying performance",
    circuitHistory: "circuit history",
    constructorStrength: "constructor strength",
};

function joinWithAnd(items) {
    if (items.length <= 1) return items[0] ?? "";
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/* Every status the backend can send for a dataAvailability entry, and how
   to show it — "pending"/"limited" are genuine states, not a lesser
   version of "unavailable": pending means the data hasn't happened yet,
   limited means the source only partially covers that topic. */
const STATUS_META = {
    available: { label: "Available", className: "pr-status--available", Icon: CheckCircle2 },
    pending: { label: "Pending", className: "pr-status--pending", Icon: Clock },
    limited: { label: "Limited", className: "pr-status--limited", Icon: Info },
    unavailable: { label: "Unavailable", className: "pr-status--unavailable", Icon: Circle },
};

function StatusBadge({ status }) {
    const meta = STATUS_META[status] ?? STATUS_META.unavailable;
    return (
        <span className={`pr-status ${meta.className}`}>
            <meta.Icon size={13} aria-hidden="true" />
            {meta.label}
        </span>
    );
}

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

/* Fetches Phase 14 evaluation data (performance summary + prediction
   history, which already includes full per-driver detail — no separate
   per-race call needed to expand a history row). Independent of, and
   never blocking, the primary upcoming-prediction fetch above; if this
   fails the page still shows the upcoming prediction normally. */
function useEvaluation() {
    const [state, setState] = useState({ loading: true, performance: null, races: [] });

    useEffect(() => {
        Promise.all([
            fetch(`${API}/api/predictor/performance`).then((res) => (res.ok ? res.json() : null)),
            fetch(`${API}/api/predictor/history`).then((res) => (res.ok ? res.json() : { races: [] })),
        ])
            .then(([performance, history]) => setState({ loading: false, performance, races: history?.races ?? [] }))
            .catch(() => setState({ loading: false, performance: null, races: [] }));
    }, []);

    return state;
}

/* ── Header ────────────────────────────────────────────────────────── */

function PredictorHeader({ race }) {
    return (
        <header className="pr-header">
            <div className="pr-header-inner">
                <span className="pr-eyebrow">Race Predictor</span>
                <h1 className="pr-header-gp">{race.name}</h1>
                <p className="pr-header-loc">{race.circuit} · {formatDate(race.date)}</p>
            </div>
        </header>
    );
}

/* ── Podium — an actual F1 podium presentation: no driver photos, the
   racing number carries the visual weight instead. P1 sits centered on
   a taller riser (extra top padding under a shared flex-end baseline,
   not a fabricated height) on the site's light surface, exactly the
   "major result gets a light card" treatment already used elsewhere;
   P2/P3 stay on the dark surface either side. ─────────────────────── */

function PodiumStep({ p, place, label }) {
    if (!p) return null;
    return (
        <div className={`pr-podium-step pr-podium-step--${place}`} style={{ "--pr-team-color": getTeamAccent(p.constructorId) }}>
            <span className="pr-podium-place pr-mono">{label}</span>
            <span className="pr-podium-number pr-mono">{p.driverNumber ?? "—"}</span>
            <span className="pr-podium-driver">{p.driverName}</span>
            <span className="pr-podium-constructor">{p.constructor}</span>
        </div>
    );
}

function PredictedPodium({ predictions }) {
    const [first, second, third] = predictions;
    if (!first) return null;
    return (
        <div className="pr-podium">
            <PodiumStep p={second} place="second" label="P2" />
            <PodiumStep p={first} place="first" label="P1" />
            <PodiumStep p={third} place="third" label="P3" />
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

/* ── Why this prediction — the page's main explanation, for the predicted
   winner. Distinguishes two different things instead of conflating them:
   what actually went INTO this specific winner's prediction (the intro
   sentence + factor rows below, built from winner.factors[key].available,
   which can genuinely differ per driver — e.g. a winner racing at a
   circuit for the first time has circuitHistory.available === false even
   when circuit history as a data source is generally available) versus
   what data sources exist AT ALL for this race weekend, regardless of
   whether this winner's prediction used them (Data Coverage below,
   sourced from the global dataAvailability — includes states like
   "Pending"/"Limited" that a used/unused list alone can't express). ── */

function WhyThisPrediction({ winner, dataAvailability, weather }) {
    if (!winner) return null;

    const usedFactors = Object.keys(FACTOR_PROSE).filter((key) => winner.factors?.[key]?.available);
    const intro = usedFactors.length > 0
        ? `The prediction is based on a combination of ${joinWithAnd(usedFactors.map((k) => FACTOR_PROSE[k]))}.`
        : "This prediction is based on the model's baseline power ranking — none of the usual per-race factors are available yet.";

    return (
        <div className="pr-why-wrap">
            <p className="pr-why-intro">{intro}</p>

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

            <div className="pr-why-coverage">
                <span className="pr-panel-title">Data Coverage</span>
                <DataAvailabilityTable dataAvailability={dataAvailability} weather={weather} />
            </div>
        </div>
    );
}

const AVAILABILITY_LABELS = {
    historicalStandings: "Historical data",
    currentSeasonData: "Current season",
    circuitHistory: "Circuit history",
    qualifying: "Qualifying",
    weatherForecast: "Weather forecast",
    pitStopStrategy: "Pit-stop strategy",
    tyreCompounds: "Tyre compounds",
};

const WEATHER_CONDITIONS = {
    0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
    61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow", 75: "Heavy snow",
    80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
    95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};

/* Forecast for the upcoming race session — explicitly labeled as such so
   it's never confused with the Live Race page's live-session weather
   feed, which this page has nothing to do with. */
function WeatherForecastDetail({ weather }) {
    if (!weather) return null;
    const condition = WEATHER_CONDITIONS[weather.weatherCode] ?? null;
    const appliesTo = weather.forecastFor
        ? new Date(weather.forecastFor).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : null;

    return (
        <div className="pr-forecast">
            <span className="pr-forecast-label">FORECAST{appliesTo ? ` · ${appliesTo}` : ""}</span>
            <div className="pr-forecast-stats">
                {condition && <span className="pr-forecast-stat"><CloudSun size={13} aria-hidden="true" />{condition}</span>}
                {weather.airTemperature != null && <span className="pr-forecast-stat pr-mono"><Thermometer size={13} aria-hidden="true" />{Math.round(weather.airTemperature)}°C</span>}
                {weather.precipitationProbability != null && <span className="pr-forecast-stat pr-mono"><Droplets size={13} aria-hidden="true" />{weather.precipitationProbability}%</span>}
                {weather.windSpeed != null && <span className="pr-forecast-stat pr-mono"><Wind size={13} aria-hidden="true" />{Math.round(weather.windSpeed)} km/h</span>}
            </div>
        </div>
    );
}

function DataAvailabilityTable({ dataAvailability, weather }) {
    if (!dataAvailability) return null;
    const rows = Object.entries(dataAvailability).filter(([key]) => AVAILABILITY_LABELS[key]);

    return (
        <dl className="pr-kv pr-kv--availability">
            {rows.map(([key, entry]) => (
                <div className="pr-kv-row" key={key}>
                    <dt>{AVAILABILITY_LABELS[key]}</dt>
                    <dd>
                        <StatusBadge status={entry?.status} />
                        {key === "weatherForecast" && entry?.status === "available" && <WeatherForecastDetail weather={weather} />}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   PHASE 14 — MODEL PERFORMANCE / PREDICTION HISTORY / PREDICTION VS
   REALITY. All from GET /api/predictor/performance and /history — no
   math happens here, only formatting. Never claims accuracy the data
   doesn't support: an empty/low race count gets an honest empty state,
   not a padded-looking percentage.
   ═══════════════════════════════════════════════════════════════════ */

const STATUS_LABELS = {
    classified: null,
    classified_retired: "Retired",
    dsq: "DSQ",
    dns: "DNS",
    unclassified: "Not Classified",
    no_result: "No Result",
};

function ModelPerformanceSection({ performance, loading }) {
    if (loading) return <div className="pr-hub-loading">Loading model performance…</div>;

    if (!performance?.available) {
        return (
            <div className="pr-compact-empty">
                <BarChart3 size={18} aria-hidden="true" />
                <div className="pr-compact-empty-body">
                    <span className="pr-compact-empty-title">No evaluated races yet</span>
                    <span className="pr-compact-empty-desc">Predictions will be scored automatically once their races are completed.</span>
                </div>
            </div>
        );
    }

    const stats = [
        [performance.racesEvaluated, "Races Evaluated"],
        [pct(performance.winnerAccuracy), "Winner Accuracy"],
        [pct(performance.avgPodiumHitRate), "Podium Hit Rate"],
        [pct(performance.avgTop5HitRate), "Top 5 Hit Rate"],
        [pct(performance.avgTop10HitRate), "Top 10 Hit Rate"],
        [performance.meanPositionError ?? "—", "Mean Position Error"],
    ];

    return (
        <div className="pr-perf">
            <div className="pr-perf-grid">
                {stats.map(([value, label]) => (
                    <div className="pr-perf-stat" key={label}>
                        <span className="pr-mono pr-perf-value">{value}</span>
                        <span className="pr-perf-label">{label}</span>
                    </div>
                ))}
            </div>
            {performance.driverPerformance?.length > 0 && (
                <div className="pr-perf-drivers">
                    <span className="pr-panel-title">Driver-Level Evaluation</span>
                    {performance.driverPerformance.map((d) => (
                        <div className="pr-perf-driver-row" key={d.driverId}>
                            <span className="pr-driver-code pr-mono">{d.driverCode ?? d.driverId}</span>
                            <span className="pr-driver-name">{d.driverName}</span>
                            <span className="pr-mono">{d.predictionsEvaluated} races</span>
                            <span className="pr-mono">avg err {d.avgPositionError}</span>
                            <span className="pr-mono">best {d.bestPredictionError}</span>
                            <span className="pr-mono">worst {d.worstPredictionError}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PredictionVsRealityDetail({ evaluation }) {
    const sorted = [...evaluation.driverEvaluations].sort((a, b) => a.predictedPosition - b.predictedPosition);
    return (
        <div className="pr-vs-reality">
            <div className="pr-timing-scroll">
                <table className="pr-table">
                    <thead>
                        <tr>
                            <th>Driver</th>
                            <th>Predicted</th>
                            <th>Actual</th>
                            <th>Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((d) => (
                            <tr key={d.driverId}>
                                <td>
                                    <span className="pr-driver-chip">
                                        <span className="pr-driver-code pr-mono">{d.driverCode ?? d.driverId}</span>
                                        <span className="pr-driver-name">{d.driverName}</span>
                                    </span>
                                </td>
                                <td className="pr-mono">P{d.predictedPosition}</td>
                                <td className="pr-mono">{d.actualPosition ? `P${d.actualPosition}` : (STATUS_LABELS[d.status] ?? "—")}</td>
                                <td className="pr-mono">{d.positionError ?? "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function PredictionHistorySection({ races, loading }) {
    const [expandedKey, setExpandedKey] = useState(null);

    if (loading) return <div className="pr-hub-loading">Loading prediction history…</div>;

    const eligible = races.filter((r) => r.eligible);

    if (eligible.length === 0) {
        return (
            <div className="pr-compact-empty">
                <History size={18} aria-hidden="true" />
                <div className="pr-compact-empty-body">
                    <span className="pr-compact-empty-title">No evaluated predictions yet</span>
                    <span className="pr-compact-empty-desc">Prediction history will populate automatically after predictions are saved and their races are completed.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="pr-history">
            {eligible.map((r) => {
                const key = `${r.season}-${r.round}`;
                const isOpen = expandedKey === key;
                return (
                    <div className="pr-history-item" key={key}>
                        <button
                            type="button"
                            className="pr-history-row"
                            aria-expanded={isOpen}
                            onClick={() => setExpandedKey(isOpen ? null : key)}
                        >
                            <span className="pr-history-race">{r.raceName}</span>
                            <div className="pr-history-compare">
                                <div className="pr-history-compare-row">
                                    <span className="pr-history-label">Predicted</span>
                                    <span className="pr-history-driver">{r.predictedWinner ?? "—"}</span>
                                </div>
                                <div className="pr-history-compare-row">
                                    <span className="pr-history-label">Actual</span>
                                    <span className="pr-history-driver">{r.actualWinner ?? "—"}</span>
                                </div>
                            </div>
                            <span className={`pr-history-badge${r.metrics.winnerCorrect ? " pr-history-badge--correct" : ""}`}>
                                {r.metrics.winnerCorrect ? "Correct" : "Incorrect"}
                            </span>
                        </button>
                        {isOpen && (
                            <div className="pr-history-detail">
                                <div className="pr-detail-grid">
                                    <div className="pr-detail-stat"><span>{pct(r.metrics.podiumHitRate)}</span><small>Podium</small></div>
                                    <div className="pr-detail-stat"><span>{pct(r.metrics.top5HitRate)}</span><small>Top 5</small></div>
                                    <div className="pr-detail-stat"><span>{pct(r.metrics.top10HitRate)}</span><small>Top 10</small></div>
                                    <div className="pr-detail-stat"><span>{r.metrics.meanPositionError ?? "—"}</span><small>Mean Error</small></div>
                                    <div className="pr-detail-stat"><span>{r.predictionSource === "backtest" ? "Backtested" : "Live"}</span><small>Source</small></div>
                                </div>
                                <span className="pr-panel-title">Prediction vs Reality</span>
                                <PredictionVsRealityDetail evaluation={r} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
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
    const evaluation = useEvaluation();

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

    const { race, dataAvailability, weather, predictions, limitations } = data;
    const winner = predictions?.[0] ?? null;

    return (
        <div className="pr">
            <PredictorHeader race={race} />
            <main className="pr-main">
                <Panel title="Predicted Podium">
                    <PredictedPodium predictions={predictions} />
                </Panel>

                {/* 3. Main analysis grid — full classification (~70%) beside
                   Why This Prediction (~30%), not another stacked section */}
                <div className="pr-grid pr-grid--main">
                    <Panel title="Predicted Classification">
                        <ClassificationTable predictions={predictions} />
                    </Panel>
                    <Panel title="Why This Prediction?">
                        <WhyThisPrediction winner={winner} dataAvailability={dataAvailability} weather={weather} />
                    </Panel>
                </div>

                <p className="pr-disclaimer">
                    Predictions are model estimates based on available historical and race-weekend data. They are not guaranteed race outcomes.
                    {limitations?.length > 0 && ` ${limitations[0]}`}
                </p>

                {/* 4. Prediction History + Model Performance — side by side,
                   not two giant stacked full-width cards */}
                <div className="pr-grid pr-grid--split">
                    <Panel title="Prediction History">
                        <PredictionHistorySection races={evaluation.races} loading={evaluation.loading} />
                    </Panel>
                    <Panel title="Model Performance">
                        <ModelPerformanceSection performance={evaluation.performance} loading={evaluation.loading} />
                    </Panel>
                </div>
                <p className="pr-disclaimer">
                    Model performance is calculated from completed races for which a prediction was generated before the race. Metrics may change as additional races are evaluated.
                </p>
            </main>
        </div>
    );
}

export default Predictor;
