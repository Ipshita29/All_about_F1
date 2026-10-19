/*
 * RACE PREDICTOR — a cinematic, competition-style presentation of the
 * model's own prediction. Reads GET /api/predictor/upcoming for the next
 * Grand Prix (see server/services/predictorService.js for the actual
 * prediction engine: a weighted power-ranking converted to probabilities
 * via a Plackett-Luce Monte Carlo simulation), or GET /api/predictor/race/
 * :season/:round for a previously-predicted race picked from the selector
 * — both return the identical podium/table/data-availability shape, so the
 * whole page renders off one "active race" object regardless of which
 * endpoint it came from. A completed previous race additionally carries
 * actualPodium (the real top 3) and winnerCorrect — the predicted podium
 * is never replaced by it, both stay visible side by side.
 *
 * This is NOT a fantasy-pick game: there is no logged-in user and no
 * submitted prediction anywhere in this system, only the model's own
 * computed call. Every label on this page is written to say so plainly
 * ("MODEL PICK", "THE FORECAST") rather than imply a user action that
 * doesn't exist. This page only renders the API response — no prediction
 * math happens here, and no number is ever invented; where the engine
 * doesn't provide something, it's left out.
 */
import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronDown, History } from "lucide-react";
import { Button, EmptyState, LoadingSpinner, SearchInput } from "../components/UI";
import { getTeamAccent } from "../config/driverAssets";
import useCountdown from "../hooks/useCountdown";
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

/* Fetches the evaluation data (performance summary + prediction history).
   Independent of, and never blocking, the primary upcoming-prediction
   fetch above; also supplies the list of previously-completed races the
   selector offers. */
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

// The prediction response never carries a race's local start time, only
// its date — a model prediction only ever needed the date. The header's
// countdown borrows the one real `time` field from the public season
// schedule every other page already reads (/grandprixdashboard/:year),
// rather than guessing a kickoff hour. Returns null (no countdown shown)
// until that one extra field has loaded.
function useRaceTime(season, round) {
    const [time, setTime] = useState(null);

    useEffect(() => {
        if (!season || !round) return undefined;
        let cancelled = false;
        fetch(`${API}/grandprixdashboard/${season}`)
            .then((res) => (res.ok ? res.json() : []))
            .then((races) => {
                if (cancelled) return;
                const match = Array.isArray(races) ? races.find((r) => String(r.round) === String(round)) : null;
                setTime(match?.time ?? null);
            })
            .catch(() => {
                if (!cancelled) setTime(null);
            });
        return () => {
            cancelled = true;
        };
    }, [season, round]);

    return time;
}

/* ── Cinematic header ─────────────────────────────────────────────────
   Eyebrow + headline + GP identity + countdown, with a monochrome
   circuit map blended into the dark canvas on wide screens. The race
   selector sits top-right exactly where it did before — same working
   control, restyled. ───────────────────────────────────────────────── */

// Local track-map PNGs already exist per circuit (client/public/circuits/
// <circuitId>/map.png) for the Circuit Essentials page — reused here
// rather than reaching for an external image, so the header never
// depends on a remote URL. Desaturated + faded via CSS so it reads as a
// background graphic, not a second photo competing with the copy.
function TrackVisual({ circuitId }) {
    const [failed, setFailed] = useState(false);
    if (!circuitId || failed) return null;
    return (
        <img
            className="pr-header-track"
            src={`/circuits/${circuitId}/map.png`}
            alt=""
            aria-hidden="true"
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
}

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

function CinematicHeader({ race, countdown, resultStatus, selectorProps }) {
    const hasCountdown = countdown && countdown.total > 0;
    return (
        <header className="pr-header">
            <TrackVisual key={race.circuitId} circuitId={race.circuitId} />
            <div className="pr-header-inner">
                <div className="pr-header-top">
                    <span className="pr-eyebrow pr-mono">PREDICTOR / ROUND {race.round}</span>
                    <RaceSelector {...selectorProps} />
                </div>

                <h1 className="pr-header-headline">THE CALL.</h1>
                <p className="pr-header-gp">{race.name}</p>
                <p className="pr-header-loc pr-mono">
                    {race.circuit}{race.country ? ` · ${race.country}` : ""}
                </p>
                <p className="pr-header-date pr-mono">{formatDate(race.date)}</p>

                {hasCountdown && (
                    <div
                        className="pr-countdown"
                        role="timer"
                        aria-label={`${countdown.days} days ${countdown.hours} hours ${countdown.minutes} minutes to race start`}
                    >
                        {[[countdown.days, "D"], [countdown.hours, "H"], [countdown.minutes, "M"], [countdown.seconds, "S"]].map(([v, l]) => (
                            <span className="pr-countdown-unit" key={l}>
                                <b className="pr-mono">{String(v).padStart(2, "0")}</b>
                                <small>{l}</small>
                            </span>
                        ))}
                    </div>
                )}

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
   racing number carries the visual weight instead. P1 sits taller and
   centered; P2/P3 shorter either side, each on its own riser block, so
   the podium reads as broadcast riser geometry rather than three equal
   cards. `showTags`/`showRoles` are on for the model's own predicted
   podium (labelled "MODEL PICK" + WINNER/SECOND/THIRD so it's never
   mistaken for a user selection) and off for the plain, unmarked actual-
   result reference podium. ─────────────────────────────────────────── */

function PodiumStep({ p, place, posLabel, roleLabel, showTag }) {
    if (!p) return null;
    // exactPositionCorrect only exists once a race is completed and this
    // entry has been enriched with its real finishing position — an
    // upcoming-race prediction simply won't have the key, so this stays
    // hidden there automatically.
    const graded = "exactPositionCorrect" in p;
    return (
        <div className={`pr-podium-step pr-podium-step--${place}`} style={{ "--pr-team-color": getTeamAccent(p.constructorId) }}>
            <div className="pr-podium-card">
                {showTag && <span className="pr-podium-tag pr-mono">MODEL PICK</span>}
                <span className="pr-podium-place pr-mono">{posLabel}{roleLabel ? ` — ${roleLabel}` : ""}</span>
                <span className="pr-podium-number pr-mono">#{p.driverNumber ?? "—"}</span>
                <span className="pr-podium-driver">{p.driverName}</span>
                <span className="pr-podium-constructor">{p.constructorName}</span>
                {graded && (
                    <span className={`pr-podium-actual pr-mono ${p.exactPositionCorrect ? "pr-podium-actual--correct" : "pr-podium-actual--incorrect"}`}>
                        {p.exactPositionCorrect ? "✓" : "✕"} Actual {p.actualPosition ? `P${p.actualPosition}` : "—"}
                    </span>
                )}
            </div>
            <div className="pr-podium-riser pr-mono" aria-hidden="true">{posLabel}</div>
        </div>
    );
}

// Renders any top-3 list as a podium — the predicted top 3 (sorted by
// predictedPosition) or the actual top 3 finishers (sorted by real
// finishing position); both arrive from the API already in P1→P3 order.
function PodiumRow({ entries, showTags = false, showRoles = false }) {
    const [first, second, third] = entries;
    if (!first) return null;
    return (
        <div className="pr-podium">
            <PodiumStep p={second} place="second" posLabel="P2" roleLabel={showRoles ? "SECOND" : null} showTag={showTags} />
            <PodiumStep p={first} place="first" posLabel="P1" roleLabel={showRoles ? "WINNER" : null} showTag={showTags} />
            <PodiumStep p={third} place="third" posLabel="P3" roleLabel={showRoles ? "THIRD" : null} showTag={showTags} />
        </div>
    );
}

/* ── Driver grid — search + constructor chips over the model's full
   field, replacing the old single wide table with a denser two-column
   card grid. Chips are derived from whichever constructors are actually
   in this race's field, never a hardcoded list, so a grid change next
   season needs no code change here. ──────────────────────────────────── */

function DriverCard({ p, graded }) {
    const actual = graded && "exactPositionCorrect" in p;
    return (
        <div className="pr-driver-card" style={{ "--pr-team-color": getTeamAccent(p.constructorId) }}>
            <span className="pr-mono pr-driver-card-pos">P{p.predictedPosition}</span>

            <div className="pr-driver-card-id">
                <span className="pr-driver-card-name">
                    <span className="pr-mono pr-driver-card-code">{p.driverCode ?? p.driverId}</span>
                    {p.driverName}
                </span>
                <span className="pr-driver-card-team">#{p.driverNumber ?? "—"} · {p.constructorName}</span>
            </div>

            <span className={`pr-confidence pr-confidence--${p.confidence}`}>{p.confidence?.toUpperCase() ?? "—"}</span>

            <div className="pr-driver-card-stats pr-mono">
                <span>WIN <b>{pct(p.winProbability)}</b></span>
                <span>POD <b>{pct(p.podiumProbability)}</b></span>
                <span>TOP5 <b>{pct(p.top5Probability)}</b></span>
                <span>TOP10 <b>{pct(p.top10Probability)}</b></span>
            </div>

            {actual && (
                <span className={`pr-driver-card-actual pr-mono ${p.exactPositionCorrect ? "pr-driver-card-actual--correct" : ""}`}>
                    {p.exactPositionCorrect ? "✓" : "✕"} Actual {p.actualPosition ? `P${p.actualPosition}` : "—"}
                </span>
            )}
        </div>
    );
}

function DriverGridSection({ predictions, graded }) {
    const [query, setQuery] = useState("");
    const [team, setTeam] = useState("all");

    const constructors = useMemo(() => {
        const seen = new Map();
        predictions.forEach((p) => {
            if (!seen.has(p.constructorId)) seen.set(p.constructorId, p.constructorName);
        });
        return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [predictions]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return predictions.filter((p) => {
            if (team !== "all" && p.constructorId !== team) return false;
            if (!q) return true;
            return (
                p.driverName.toLowerCase().includes(q) ||
                p.constructorName.toLowerCase().includes(q) ||
                (p.driverCode ?? "").toLowerCase().includes(q)
            );
        });
    }, [predictions, query, team]);

    return (
        <section className="pr-grid-section">
            <div className="pr-grid-controls">
                <SearchInput
                    placeholder="Search drivers or teams…"
                    aria-label="Search drivers or teams"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <div className="pr-chip-row" role="group" aria-label="Filter by constructor">
                    <button
                        type="button"
                        className={`pr-chip${team === "all" ? " pr-chip--active" : ""}`}
                        onClick={() => setTeam("all")}
                    >
                        All
                    </button>
                    {constructors.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            className={`pr-chip${team === c.id ? " pr-chip--active" : ""}`}
                            style={{ "--pr-chip-color": getTeamAccent(c.id) }}
                            onClick={() => setTeam((t) => (t === c.id ? "all" : c.id))}
                        >
                            <span className="pr-chip-dot" aria-hidden="true" />
                            {c.name}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <EmptyState title="No drivers match" description="Try a different search term or constructor filter." />
            ) : (
                <div className="pr-driver-grid">
                    {filtered.map((p) => (
                        <DriverCard key={p.driverId} p={p} graded={graded} />
                    ))}
                </div>
            )}
        </section>
    );
}

/* ── The Forecast — sidebar summary of the model's own podium call, not
   an editable "your call" panel (there's nothing for a user to submit).
   States plainly, from the real `stage` field, whether this forecast is
   still pre-qualifying (and so will change) or locked to the real
   starting grid (and won't). ─────────────────────────────────────────── */

function ForecastSidebar({ top3, stage, baseline }) {
    const locked = stage === "post_qualifying";
    return (
        <aside className="pr-sidebar">
            <Panel title="The Forecast" className="pr-panel--sidebar">
                <span className={`pr-sidebar-stage pr-mono${locked ? " pr-sidebar-stage--locked" : ""}`}>
                    {locked ? "LOCKED TO GRID" : "PRE-QUALIFYING"}
                </span>

                <ul className="pr-sidebar-picks">
                    {[["P1", top3[0]], ["P2", top3[1]], ["P3", top3[2]]].map(([label, p]) => (
                        <li className="pr-sidebar-pick" key={label}>
                            <span className="pr-mono pr-sidebar-pick-pos">{label}</span>
                            {p ? (
                                <span className="pr-sidebar-pick-driver">
                                    <span className="pr-sidebar-pick-dot" style={{ background: getTeamAccent(p.constructorId) }} aria-hidden="true" />
                                    {p.driverName}
                                </span>
                            ) : (
                                <span className="pr-sidebar-pick-empty">—</span>
                            )}
                        </li>
                    ))}
                </ul>

                {baseline && (
                    <p className="pr-sidebar-note">
                        Ranked by <strong>{baseline.label}</strong>.
                    </p>
                )}
                <p className="pr-sidebar-note pr-sidebar-note--muted">
                    {locked
                        ? "This forecast is locked to the real starting grid and will not change again before the race."
                        : "This forecast updates automatically once qualifying sets the real starting grid."}
                </p>

                <Button
                    variant="secondary"
                    className="pr-sidebar-cta"
                    onClick={() => document.getElementById("pr-driver-grid")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                    View Full Grid Forecast
                </Button>
            </Panel>
        </aside>
    );
}

/* ══════════════════════════════════════════════════════════════════
   SEASON PERFORMANCE STRIP / METHODOLOGY. Both from GET
   /api/predictor/performance and /history (unaffected by which race the
   selector shows above — these summarize every evaluated race). No math
   happens here, only formatting. Never claims accuracy the data doesn't
   support: an empty/low race count gets an honest empty state.
   ══════════════════════════════════════════════════════════════════ */

function SeasonPerformanceStrip({ performance, races, loading }) {
    const [expanded, setExpanded] = useState(false);

    if (loading) return <div className="pr-hub-loading">Loading model performance…</div>;

    if (!performance?.available) {
        return (
            <Panel title="Season Performance" className="pr-strip">
                <div className="pr-compact-empty">
                    <BarChart3 size={18} aria-hidden="true" />
                    <div className="pr-compact-empty-body">
                        <span className="pr-compact-empty-title">No evaluated races yet</span>
                        <span className="pr-compact-empty-desc">The model's accuracy will appear automatically once races are completed and scored.</span>
                    </div>
                </div>
            </Panel>
        );
    }

    const eligible = races.filter((r) => r.eligible).slice().reverse();
    const stats = [
        [performance.racesEvaluated, "Races Scored"],
        [pct(performance.winnerAccuracy), "Winner Accuracy"],
        [pct(performance.avgPodiumHitRate), "Podium Accuracy"],
        [pct(performance.avgTop5HitRate), "Top 5 Hit Rate"],
        [pct(performance.avgTop10HitRate), "Top 10 Hit Rate"],
        [performance.meanPositionError ?? "—", "Mean Position Error"],
    ];

    return (
        <Panel title="Season Performance" className="pr-strip">
            <div className="pr-strip-stats">
                {stats.map(([value, label]) => (
                    <div className="pr-strip-stat" key={label}>
                        <span className="pr-mono pr-strip-value">{value}</span>
                        <span className="pr-strip-label">{label}</span>
                    </div>
                ))}
            </div>

            {eligible.length === 0 ? (
                <div className="pr-compact-empty">
                    <History size={18} aria-hidden="true" />
                    <div className="pr-compact-empty-body">
                        <span className="pr-compact-empty-title">No evaluated predictions yet</span>
                        <span className="pr-compact-empty-desc">Prediction history will populate automatically once races are completed.</span>
                    </div>
                </div>
            ) : expanded ? (
                <>
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
                    <button type="button" className="pr-strip-toggle pr-mono" onClick={() => setExpanded(false)}>
                        SHOW COMPACT VIEW
                    </button>
                </>
            ) : (
                <>
                    <ul className="pr-strip-history-list">
                        {eligible.slice(0, 10).map((r) => (
                            <li
                                key={`${r.season}-${r.round}`}
                                className={`pr-strip-history-chip${r.metrics.winnerCorrect ? " pr-strip-history-chip--correct" : " pr-strip-history-chip--incorrect"}`}
                                title={r.raceName}
                            >
                                {r.metrics.winnerCorrect ? "✓" : "✕"}
                            </li>
                        ))}
                    </ul>
                    <button type="button" className="pr-strip-toggle pr-mono" onClick={() => setExpanded(true)}>
                        VIEW FULL HISTORY
                    </button>
                </>
            )}
        </Panel>
    );
}

/* ── Data Used — the data sources the engine always draws on, plus
   qualifying/sprint shown honestly whenever that data doesn't exist yet
   for the selected race, instead of being silently dropped. Never a
   fabricated value — a "Pending"/"Not available" row states plainly
   that the number isn't in the prediction, rather than omitting it.
   Collapsed by default below the main workspace — secondary evidence,
   not the main interaction. ─────────────────────────────────────────── */

const DATA_USED_ROWS = [
    ["historicalStandings", "Current championship standings"],
    ["currentSeasonData", "Recent race form"],
    ["circuitHistory", "Circuit history"],
];

const CONDITIONAL_ROWS = [
    ["qualifying", "Qualifying performance"],
    ["sprintPerformance", "Sprint performance"],
];

// `baseline` identifies which single, multi-season-validated feature
// actually drove the ranking for this race's stage (see predictorService.js
// STAGE_BASELINES) — this is the one line that explains "why this order".
function BaselineNote({ baseline }) {
    if (!baseline) return null;
    return (
        <p className="pr-used-baseline">
            Ranked by: <strong>{baseline.label}</strong>
            <br />
            <span className="pr-used-baseline-reason">{baseline.reason}</span>
        </p>
    );
}

function DataUsedCard({ dataAvailability, baseline }) {
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
        <>
            <BaselineNote baseline={baseline} />
            <ul className="pr-used-list">
                {rows.map((row) => (
                    <li key={row.label} className={row.status !== "available" ? "pr-used-list-pending" : ""}>
                        {row.status === "available" ? row.label : `○ ${row.label} — ${row.status === "pending" ? "Pending" : "Not available"}`}
                    </li>
                ))}
            </ul>
        </>
    );
}

function MethodologyDisclosure({ dataAvailability, baseline }) {
    const [open, setOpen] = useState(false);
    return (
        <Panel className="pr-methodology">
            <button
                type="button"
                className="pr-methodology-toggle pr-mono"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
            >
                HOW THIS PREDICTION WAS MADE
                <ChevronDown size={14} className={`pr-methodology-chevron${open ? " pr-methodology-chevron--open" : ""}`} aria-hidden="true" />
            </button>
            {open && (
                <div className="pr-methodology-body">
                    <DataUsedCard dataAvailability={dataAvailability} baseline={baseline} />
                </div>
            )}
        </Panel>
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

    const viewingPast = Boolean(selectedKey);
    const active = data?.available
        ? (viewingPast
            ? raceDetail.data
            : { race: data.race, stage: data.stage, baseline: data.baseline, dataAvailability: data.dataAvailability, predictions: data.predictions, completed: false, winnerCorrect: null })
        : null;

    // Hooks must run unconditionally on every render — headerRace may be
    // null while loading/erroring, so these two stay null-safe internally
    // rather than being skipped by an early return above this point.
    const headerRace = active?.race ?? data?.race ?? null;
    const raceTime = useRaceTime(headerRace?.season, headerRace?.round);
    const countdownTarget = headerRace?.date && raceTime ? new Date(`${headerRace.date}T${raceTime}`) : null;
    const countdown = useCountdown(countdownTarget);

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
    const resultStatus = active?.completed ? { correct: active.winnerCorrect } : null;
    const graded = Boolean(active?.completed);

    return (
        <div className="pr">
            <CinematicHeader race={headerRace} countdown={countdown} resultStatus={resultStatus} selectorProps={selectorProps} />
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
                        <div className="pr-workspace">
                            <div className="pr-workspace-main">
                                <Panel title="Predicted Podium" className="pr-panel--podium">
                                    {/* Per-driver, not a single verdict for the whole
                                       top 3: each predicted step above already shows
                                       its own actual position + ✓/✕ once graded, this
                                       is just the roll-up count. */}
                                    {active.completed && active.actualPodium?.length > 0 && (
                                        <p className="pr-podium-summary pr-mono">
                                            {active.predictions.slice(0, 3).filter((p) => p.exactPositionCorrect).length}/3 EXACT PODIUM POSITIONS
                                        </p>
                                    )}
                                    <PodiumRow entries={active.predictions} showTags showRoles />
                                </Panel>

                                {/* Only for a completed previous race — the predicted
                                   podium above is never replaced, this is purely an
                                   addition showing what actually happened alongside
                                   it, for comparison. */}
                                {active.completed && active.actualPodium?.length > 0 && (
                                    <Panel title="Actual Podium" className="pr-panel--podium pr-panel--podium-actual">
                                        <PodiumRow entries={active.actualPodium} />
                                    </Panel>
                                )}

                                <div id="pr-driver-grid">
                                    <DriverGridSection predictions={active.predictions} graded={graded} />
                                </div>

                                <MethodologyDisclosure dataAvailability={active.dataAvailability} baseline={active.baseline} />
                            </div>

                            <ForecastSidebar top3={active.predictions.slice(0, 3)} stage={active.stage} baseline={active.baseline} />
                        </div>

                        <SeasonPerformanceStrip performance={evaluation.performance} races={evaluation.races} loading={evaluation.loading} />
                    </>
                )}
            </main>
        </div>
    );
}

export default Predictor;
