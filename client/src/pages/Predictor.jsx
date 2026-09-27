/*
 * RACE PREDICTOR — reads GET /api/predictor/upcoming for the next Grand
 * Prix (see server/services/predictorService.js for the actual prediction
 * engine: a weighted power-ranking converted to probabilities via a
 * Plackett-Luce Monte Carlo simulation), or GET /api/predictor/race/:season/
 * :round for a previously-predicted race picked from the selector below —
 * both return the identical podium/table/data-availability shape, so the
 * whole page renders off one "active race" object regardless of which
 * endpoint it came from. This page only renders that response — no
 * prediction math happens here. Every number shown traces directly to a
 * field in the real API response; where the engine doesn't provide
 * something, it's left out rather than invented.
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

/* ── Data hooks ────────────────────────────────────────────────────── */

// The upcoming race — fetched once, manual retry only, never polled.
function usePrediction() {
    const [state, setState] = useState({ loading: true, error: false, data: null });

    const fetchPrediction = () => {
        fetch(`${API}/api/predictor/upcoming`)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad status"))))
            .then((data) => setState({ loading: false, error: false, data }))
            .catch(() => setState({ loading: false, error: true, data: null }));
    };

    useEffect(fetchPrediction, []);

    const retry = () => {
        setState({ loading: true, error: false, data: null });
        fetchPrediction();
    };

    return { ...state, retry };
}

/* Fetches Phase 14 evaluation data (performance summary + prediction
   history). Independent of, and never blocking, the primary
   upcoming-prediction fetch above; also supplies the list of previously-
   completed races the selector offers. */
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

// A specific past race chosen from the selector — `selectedKey` is
// `${season}-${round}` or null (meaning "show the upcoming race instead",
// handled entirely by usePrediction above; this hook does nothing then).
// `loading`/`error`/`data` are derived by comparing the key the last
// response belongs to against the currently-selected key, rather than an
// effect setting a "loading" flag directly — a stale response for a key
// the user has since navigated away from is never shown as current.
function useRaceDetail(selectedKey) {
    const [state, setState] = useState({ key: null, error: false, data: null });
    const [retryToken, setRetryToken] = useState(0);

    useEffect(() => {
        if (!selectedKey) return;
        let cancelled = false;
        const [season, round] = selectedKey.split("-");
        fetch(`${API}/api/predictor/race/${season}/${round}`)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad status"))))
            .then((payload) => {
                if (cancelled) return;
                if (!payload.available) return Promise.reject(new Error("unavailable"));
                setState({ key: selectedKey, error: false, data: payload });
            })
            .catch(() => {
                if (!cancelled) setState({ key: selectedKey, error: true, data: null });
            });
        return () => {
            cancelled = true;
        };
    }, [selectedKey, retryToken]);

    const isCurrent = state.key === selectedKey;
    return {
        loading: Boolean(selectedKey) && !isCurrent,
        error: isCurrent && state.error,
        data: isCurrent ? state.data : null,
        retry: () => setRetryToken((t) => t + 1),
    };
}

/* ── Header + race selector + result indicator ───────────────────────
   The selector sits beside the eyebrow, offering "Upcoming Race" plus
   every previously-evaluated race; picking one updates the whole page.
   The ✓/✕ result line only appears for a completed race, stays small,
   and never replaces the prediction below it. ─────────────────────── */

function RaceSelector({ options, selectedKey, onChange }) {
    return (
        <select
            className="pr-race-select pr-mono"
            value={selectedKey ?? "upcoming"}
            onChange={(e) => onChange(e.target.value === "upcoming" ? null : e.target.value)}
            aria-label="Select race"
        >
            <option value="upcoming">Upcoming Race</option>
            {options.map((r) => (
                <option key={`${r.season}-${r.round}`} value={`${r.season}-${r.round}`}>{r.raceName}</option>
            ))}
        </select>
    );
}

function PredictorHeader({ race, resultStatus, selectorProps }) {
    return (
        <header className="pr-header">
            <div className="pr-header-inner">
                <div className="pr-header-top">
                    <span className="pr-eyebrow">Race Predictor</span>
                    <RaceSelector {...selectorProps} />
                </div>
                <h1 className="pr-header-gp">{race.name}</h1>
                <p className="pr-header-loc">{race.circuit} · {formatDate(race.date)}</p>
                {resultStatus && (
                    <span className={`pr-result-badge pr-mono ${resultStatus.correct ? "pr-result-badge--correct" : "pr-result-badge--incorrect"}`}>
                        {resultStatus.correct ? "✓" : "✕"} Prediction Result · {resultStatus.correct ? "Correct" : "Incorrect"}
                    </span>
                )}
            </div>
        </header>
    );
}

/* ── Podium — an actual F1 podium presentation: no driver photos, the
   racing number carries the visual weight instead. Each step is a card
   sitting on its own riser block (P1 tallest, centered on the site's
   light surface; P2/P3 shorter, either side on the dark surface) so the
   podium reads as broadcast-style riser geometry rather than three equal
   cards. A thin team-color line runs across every card top; Milano Red
   only ever shows up as P1's fallback accent when a team has no mapped
   color, never applied everywhere at once. ──────────────────────────── */

function PodiumStep({ p, place, label }) {
    if (!p) return null;
    return (
        <div className={`pr-podium-step pr-podium-step--${place}`} style={{ "--pr-team-color": getTeamAccent(p.constructorId) }}>
            <div className="pr-podium-card">
                <span className="pr-podium-place pr-mono">{label}</span>
                <span className="pr-podium-number pr-mono">{p.driverNumber ?? "—"}</span>
                <span className="pr-podium-driver">{p.driverName}</span>
                <span className="pr-podium-constructor">{p.constructor}</span>
            </div>
            <div className="pr-podium-riser pr-mono" aria-hidden="true">{label}</div>
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

/* ── Full classification table ────────────────────────────────────── */

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
   MODEL PERFORMANCE / PREDICTION HISTORY / DATA USED. All from GET
   /api/predictor/performance and /history (unaffected by which race the
   selector shows above — these summarize every evaluated race) — no math
   happens here, only formatting. Never claims accuracy the data doesn't
   support: an empty/low race count gets an honest empty state.
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

/* ── Data Used — the four sources the engine always draws on, plus
   qualifying/sprint shown honestly whenever that data doesn't exist yet
   for the selected race, instead of being silently dropped. Never a
   fabricated value — a "Pending"/"Not available" row states plainly
   that the number isn't in the prediction, rather than omitting it. ── */

const DATA_USED_ROWS = [
    ["historicalStandings", "Current championship standings"],
    ["currentSeasonData", "Recent race form"],
    ["circuitHistory", "Circuit history"],
];

const CONDITIONAL_ROWS = [
    ["qualifying", "Qualifying performance"],
    ["sprintPerformance", "Sprint performance"],
];

function DataUsedCard({ dataAvailability }) {
    const used = DATA_USED_ROWS
        .filter(([key]) => dataAvailability?.[key]?.status === "available")
        .map((row) => ({ label: row[1], status: "available" }));
    used.push({ label: "Constructor performance", status: "available" });

    // sprintPerformance only exists in the response at all on a sprint
    // weekend — a normal weekend correctly shows no Sprint row rather
    // than a fabricated "not available" for a session that never happens.
    const conditional = CONDITIONAL_ROWS
        .filter(([key]) => Boolean(dataAvailability?.[key]))
        .map(([key, label]) => ({ label, status: dataAvailability[key].status }));

    const rows = [...used, ...conditional];

    return (
        <ul className="pr-used-list">
            {rows.map((row) => (
                <li key={row.label} className={row.status !== "available" ? "pr-used-list-pending" : ""}>
                    {row.status === "available" ? row.label : `○ ${row.label} — ${row.status === "pending" ? "Pending" : "Not available"}`}
                </li>
            ))}
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
    const [selectedKey, setSelectedKey] = useState(null);
    const raceDetail = useRaceDetail(selectedKey);

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

    const eligiblePastRaces = evaluation.races.filter((r) => r.eligible).slice().reverse();
    const selectorProps = { options: eligiblePastRaces, selectedKey, onChange: setSelectedKey };
    const viewingPast = Boolean(selectedKey);

    const active = viewingPast
        ? raceDetail.data
        : { race: data.race, dataAvailability: data.dataAvailability, predictions: data.predictions, completed: false, winnerCorrect: null };

    const headerRace = active?.race ?? data.race;
    const resultStatus = active?.completed ? { correct: active.winnerCorrect } : null;

    return (
        <div className="pr">
            <PredictorHeader race={headerRace} resultStatus={resultStatus} selectorProps={selectorProps} />
            <main className="pr-main">
                {viewingPast && raceDetail.loading && <div className="pr-hub-loading">Loading this race's prediction…</div>}

                {viewingPast && raceDetail.error && (
                    <EmptyState
                        title="Prediction unavailable"
                        description="Could not load this race's prediction right now."
                        action={<Button variant="secondary" onClick={raceDetail.retry}>Retry</Button>}
                    />
                )}

                {active && (
                    <>
                        <Panel title="Predicted Podium">
                            <PredictedPodium predictions={active.predictions} />
                        </Panel>

                        <Panel title="Predicted Race Order">
                            <ClassificationTable predictions={active.predictions} />
                        </Panel>

                        {/* Data Used / Prediction History / Model Performance — three
                           equal cards side by side, the page's only supporting
                           evidence beyond the podium and the table. */}
                        <div className="pr-grid pr-grid--three">
                            <Panel title="Data Used">
                                <DataUsedCard dataAvailability={active.dataAvailability} />
                            </Panel>
                            <Panel title="Prediction History">
                                <PredictionHistorySection races={evaluation.races} loading={evaluation.loading} />
                            </Panel>
                            <Panel title="Model Performance">
                                <ModelPerformanceSection performance={evaluation.performance} loading={evaluation.loading} />
                            </Panel>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}

export default Predictor;
