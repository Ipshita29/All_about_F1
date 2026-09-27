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
import { useEffect, useState } from "react";
import { BarChart3, History } from "lucide-react";
import { Button, EmptyState, LoadingSpinner } from "../components/UI";
import { getTeamAccent } from "../config/driverAssets";
import "../styles/pages/Predictor.css";
import { API_BASE_URL as API } from "../config/api";

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

/* Dense and flat — every predicted-order column already shown inline,
   no expand/collapse row for a per-driver factor breakdown that isn't
   part of this page anymore. */
function ClassificationTable({ predictions }) {
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
                    {predictions.map((p) => (
                        <tr key={p.driverId}>
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
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   PHASE 14 — MODEL PERFORMANCE / PREDICTION HISTORY / PREDICTION VS
   REALITY. All from GET /api/predictor/performance and /history — no
   math happens here, only formatting. Never claims accuracy the data
   doesn't support: an empty/low race count gets an honest empty state,
   not a padded-looking percentage.
   ═══════════════════════════════════════════════════════════════════ */

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
        <div className="pr-perf-grid">
            {stats.map(([value, label]) => (
                <div className="pr-perf-stat" key={label}>
                    <span className="pr-mono pr-perf-value">{value}</span>
                    <span className="pr-perf-label">{label}</span>
                </div>
            ))}
        </div>
    );
}

/* Compact ✓/✕ only — no predicted/actual driver text, no per-race
   metrics detail. That level of comparison isn't part of this page
   anymore; the grand prix name and whether the predicted winner was
   correct is the whole point of this card. */
function PredictionHistorySection({ races, loading }) {
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
        <ul className="pr-history">
            {eligible.map((r) => (
                <li className="pr-history-row" key={`${r.season}-${r.round}`}>
                    <span className="pr-history-race">{r.raceName}</span>
                    <span className={`pr-history-mark${r.metrics.winnerCorrect ? " pr-history-mark--correct" : " pr-history-mark--incorrect"}`}>
                        {r.metrics.winnerCorrect ? "✓" : "✕"}
                    </span>
                </li>
            ))}
        </ul>
    );
}

/* ── Data Used — only the sources genuinely used by this prediction,
   filtered from the real dataAvailability the engine already computed
   (never a fixed list shown regardless of status — e.g. qualifying is
   left out here while it's still "pending"). Constructor performance
   is derived from live standings on every request, so it's never
   anything but used. ──────────────────────────────────────────────── */

const DATA_USED_ROWS = [
    ["historicalStandings", "Current championship standings"],
    ["currentSeasonData", "Recent race form"],
    ["qualifying", "Qualifying performance"],
    ["circuitHistory", "Circuit history"],
];

function DataUsedCard({ dataAvailability }) {
    const used = DATA_USED_ROWS
        .filter(([key]) => dataAvailability?.[key]?.status === "available")
        .map(([, label]) => label);
    used.push("Constructor performance");

    return (
        <ul className="pr-used-list">
            {used.map((label) => <li key={label}>{label}</li>)}
        </ul>
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

    const { race, dataAvailability, predictions } = data;

    return (
        <div className="pr">
            <PredictorHeader race={race} />
            <main className="pr-main">
                <Panel title="Predicted Podium">
                    <PredictedPodium predictions={predictions} />
                </Panel>

                <Panel title="Predicted Race Order">
                    <ClassificationTable predictions={predictions} />
                </Panel>

                {/* Data Used / Prediction History / Model Performance — three
                   equal cards side by side, the page's only supporting
                   evidence beyond the podium and the table. */}
                <div className="pr-grid pr-grid--three">
                    <Panel title="Data Used">
                        <DataUsedCard dataAvailability={dataAvailability} />
                    </Panel>
                    <Panel title="Prediction History">
                        <PredictionHistorySection races={evaluation.races} loading={evaluation.loading} />
                    </Panel>
                    <Panel title="Model Performance">
                        <ModelPerformanceSection performance={evaluation.performance} loading={evaluation.loading} />
                    </Panel>
                </div>
            </main>
        </div>
    );
}

export default Predictor;
