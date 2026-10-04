/*
 * ═══════════════════════════════════════════════════════════════════
 * RACE PREDICTOR — DATA + PREDICTION ENGINE (Phase 12)
 * ═══════════════════════════════════════════════════════════════════
 *
 * WHAT THIS PREDICTS
 * A finishing-order estimate for the next Grand Prix: a predicted
 * classification (P1, P2, P3, …), win/podium/top-5/top-10 probabilities,
 * and an expected finishing position for every driver currently in the
 * championship standings. It answers "what does the data suggest?", not
 * "who will definitely win?" — see LIMITATIONS at the bottom.
 *
 * WHY NOT AN ML MODEL / WHY NOT PYTHON
 * There's no historical dataset here suitable for training a real
 * classifier (Jolpica gives clean structured results, but the F1 grid,
 * rules, and car performance change every season — a model trained on
 * 2021-2025 data wouldn't meaningfully generalize to 2026 without far
 * more feature/label engineering than a portfolio project justifies).
 * Instead this is a transparent, deterministic WEIGHTED POWER-RANKING
 * converted into probabilities via a PLACKETT-LUCE MONTE CARLO
 * SIMULATION — a well-established, explainable method for turning
 * per-competitor "strength" scores into full-field finishing-order
 * probabilities (used in real sports/esports ranking systems). It runs
 * in plain Node with no ML library, stays inside the existing backend
 * architecture, and every number in the output traces back to a real,
 * inspectable feature. That satisfies "explainable, maintainable,
 * portfolio-quality" better than bolting on a Python training pipeline
 * for a dataset this shape.
 *
 * DATA SOURCES (all via Jolpica/Ergast, already the project's only F1
 * data provider — see jolpicaClient.js)
 *   - current/next.json              → the upcoming race + session dates
 *   - {season}/driverstandings.json  → championship position/points
 *   - {season}/constructorstandings.json
 *   - {season}/{round}/results.json  → recent-form inputs (last N races)
 *   - {season}/{round}/qualifying.json → grid, once qualifying has run
 *   - {season}/{round}/sprint.json    → sprint result, on a sprint weekend
 *                                        only, once the sprint has run —
 *                                        folded into recentForm as this
 *                                        weekend's own most-recent data
 *                                        point (see assemblePrediction),
 *                                        not a separate scored feature
 *   - circuits/{circuitId}/results.json → all-time results at this track
 *
 * FEATURES (per driver, each normalized to roughly 0–1, higher = better)
 *   championshipStanding — standings position AND points share of the
 *                           leader, blended 40/60 (see
 *                           rankAndPointsShareScore) — rank alone can't
 *                           tell a 1-point gap from a 200-point gap
 *   recentForm           — weighted avg of the last up to 5 races, plus
 *                           this weekend's sprint result when one exists
 *                           (see computeRecentFormFeature)
 *   constructorStrength  — same rank+points-share blend, for the
 *                           constructor
 *   circuitHistory        — driver's record at this circuit, weighted
 *                           toward the most recent editions rather than
 *                           a flat all-time average (see
 *                           computeCircuitHistoryFeature)
 *   qualifying            — this weekend's grid position, ONLY once
 *                           qualifying has actually happened, nudged by
 *                           a small car-independent bonus/penalty for
 *                           out-qualifying a teammate (see
 *                           computeQualifyingFeature)
 *
 * WEIGHTS — VALIDATED BASELINES (Phase 20)
 * A multi-season, leakage-safe rolling evaluation (server/ml/, Phases
 * 13-19 — 60 pooled test races across 2024/2025/2026) compared this
 * engine's richer feature set and several trained RF variants against
 * two simple single-feature baselines, with pooled bootstrap 95%
 * confidence intervals. Result: neither stage's ML variant beat its
 * simple baseline with a CI that excluded zero (see
 * server/ml/artifacts/final_model_selection.json for the full record).
 * Per that finding, each stage's weights now put 100% of the ranking
 * weight on the one validated feature for that stage — see
 * STAGE_BASELINES below — rather than the previously reasoned-but-
 * unvalidated 5-feature blend:
 *   PRE_QUALIFYING  → championshipStanding only (all other weights 0)
 *   POST_QUALIFYING → qualifying (grid position) only (all other weights 0)
 * The other four feature functions still run and are still shown in
 * dataAvailability/features for transparency and to keep this file's
 * leakage-safe backtest reuse intact — they simply no longer influence
 * the ranking, since the validated evidence found they didn't help.
 * The Plackett-Luce simulation below is unchanged: it still turns
 * whichever single score drives a stage into full win/podium/top-5/
 * top-10 probabilities, so the API/UI contract (probabilities,
 * confidence, expectedFinish) is preserved exactly.
 *
 * A separate, Python/scikit-learn-trained candidate (the Phase 16
 * core_subset grid-anchored ensemble) was the best-performing POST
 * variant found, but is NOT wired in here: it has no existing
 * integration path into this Node service (no model export/
 * serialization format, no Python-inference bridge in this repo), and
 * building one was explicitly out of scope for this phase. It remains
 * available only as an offline, reproducible artifact under server/ml/.
 *
 * LEAKAGE PREVENTION
 * Every input above is either (a) the CURRENT championship standings —
 * which by construction only reflect races that have already finished
 * before "now" — or (b) explicitly scoped to rounds strictly before the
 * round being predicted (recentForm), or to a different race entirely
 * (circuitHistory, which excludes the race being predicted since that
 * race hasn't happened). No function in this file ever reads the
 * finishing result of the race it is predicting. The shared
 * `assemblePrediction` helper takes standings/recent-races/qualifying as
 * explicit inputs rather than fetching "current" data itself, which is
 * exactly what makes it safely reusable for historical backtesting (see
 * buildBacktestPrediction below) without risking silently including a
 * race's own result.
 *
 * CACHING + PERSISTENCE (Phase 14, hardened afterward — see below)
 * Three layers, cheapest first:
 *   1. An in-memory result cache keyed by `${season}-${round}-${stage}`
 *      (CACHE_TTL_MS) — an instant hit for repeat requests within the
 *      same server process.
 *   2. RacePrediction (Mongo) — a prediction is a historical record, not
 *      something to regenerate every page view. buildPrediction() checks
 *      Mongo for an existing doc for this exact race+stage BEFORE
 *      touching Jolpica at all; only a genuinely new race/stage
 *      generates fresh. This is also what makes evaluation possible: it
 *      reads back the prediction that actually existed before a race,
 *      never one recomputed after the fact.
 *   3. Every individual Jolpica fetch in this file goes through the
 *      shared jolpicaCache.js `cached()` helper. This is the fix for the
 *      predictor's own "Prediction unavailable, works on refresh" bug —
 *      a single request already fans out into ~10-15 uncached Jolpica
 *      calls, comfortably enough to trip the documented 3 req/s free
 *      tier on its own, before /history and /performance's own calls on
 *      the same page load are even counted. A single quick retry
 *      (getJsonRetry) additionally covers the two REQUIRED calls (next
 *      race, standings) against a one-off blip on a cold cache.
 * buildPrediction() also de-dupes concurrent callers via a shared
 * in-flight promise, so two near-simultaneous requests share one attempt
 * instead of each firing their own burst.
 */

const { getJson, getJsonRetry } = require("./jolpicaClient");
const { cached, TTL } = require("./jolpicaCache");
const RacePrediction = require("../models/RacePrediction");
const { STAGES, sanitizeStageInputs } = require("./predictionDataPolicy");

const MODEL_NAME = "AllAboutF1 Validated Baseline (Championship Standing / Grid Position) + Plackett-Luce Simulation";
const MODEL_VERSION = "2.0.0";

const RECENT_FORM_RACE_COUNT = 5;
const SIMULATION_TRIALS = 5000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Per-stage weights — see the WEIGHTS doc block above. Each stage puts all
// ranking weight on the one feature server/ml/'s Phase 13-19 evaluation
// actually validated for that stage; the rest are zeroed, not removed, so
// they still compute and still show up in `features`/dataAvailability.
const STAGE_BASELINES = {
    pre_qualifying: {
        key: "championship_standing",
        label: "Championship Standing",
        reason:
            "Before qualifying, this prediction ranks drivers by current championship standing alone. A multi-season rolling evaluation (server/ml/, Phases 13-19) found this simple baseline was not statistically beaten by any tested machine-learning model.",
        weights: { recentForm: 0, qualifying: 0, constructorStrength: 0, circuitHistory: 0, championshipStanding: 1 },
    },
    post_qualifying: {
        key: "grid_position",
        label: "Grid Position",
        reason:
            "Once qualifying is complete, this prediction ranks drivers by their grid position alone. The same evaluation found this simple baseline was not statistically beaten by any tested machine-learning model, including a grid-anchored ensemble.",
        weights: { recentForm: 0, qualifying: 1, constructorStrength: 0, circuitHistory: 0, championshipStanding: 0 },
    },
};

const LIMITATIONS = [
    "This is a statistical estimate from publicly available historical/current-season data, not a guarantee — F1 outcomes depend on many factors (incidents, weather, strategy, reliability) this model does not model.",
    "Each stage ranks drivers by a single validated feature — championship standing before qualifying, grid position after — per a multi-season rolling evaluation (server/ml/, Phases 13-19) that found no richer feature blend or trained model beat these simple baselines with statistical confidence. Recent form, constructor strength, and circuit history are still computed and shown for transparency but no longer influence the ranking.",
    "The simulation's ability transform (k=4) is a reasoned choice, not fitted against held-out historical results.",
    "Weather is shown as a forecast for the race session, sourced from Open-Meteo — it is not used as a scoring input to the prediction itself.",
    "Historical pit-stop counts and timing are available from the data source; tyre compounds are not, so compound/stint strategy is never shown or implied.",
    "Circuit history uses grid position as a proxy for qualifying position (avoids one qualifying.json fetch per past race at the circuit), weighted toward the most recent editions.",
];

// ---------------------------------------------------------------------------
// In-memory cache — see "CACHING" above
// ---------------------------------------------------------------------------

let cache = { key: null, expiresAt: 0, result: null };

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

/*
 * Every one of these used to call jolpicaClient's plain getJson()
 * uncached. A single GET /api/predictor/upcoming already fans out into
 * ~10-15 Jolpica requests (standings x2, up to 5 recent-round results,
 * a two-step circuit-history fetch, qualifying, pit stops); add /history
 * and /performance also hitting Jolpica on the same page load (see
 * evaluationService.js) and a single Predictor page view could easily
 * fire 20+ concurrent requests against a provider documented at 3 req/s
 * — the confirmed, reproducible cause of "Prediction unavailable" on
 * first load that then works after a refresh (the failure is
 * probabilistic: some bursts trip the limit, some don't). Wiring every
 * fetch through the shared cache (see jolpicaCache.js) turns repeat
 * requests for the same data into free in-memory hits instead of new
 * network calls, which is what actually fixes the flakiness — retrying
 * a request that's about to be rate-limited again doesn't. The two
 * REQUIRED calls with no safe fallback (next race, standings) also get
 * one quick retry (getJsonRetry) to absorb a one-off blip on a cold
 * cache, before any caching has had a chance to help.
 */

async function fetchUpcomingRace() {
    const data = await cached("predictor:next-race", TTL.SCHEDULE, () => getJsonRetry("/current/next.json"));
    return data.MRData.RaceTable.Races[0] || null;
}

async function fetchStandings(season) {
    const [driverData, constructorData] = await Promise.all([
        cached(`predictor:driverstandings:${season}`, TTL.STANDINGS, () => getJsonRetry(`/${season}/driverstandings.json?limit=100`)),
        cached(`predictor:constructorstandings:${season}`, TTL.STANDINGS, () => getJsonRetry(`/${season}/constructorstandings.json?limit=100`)),
    ]);
    return {
        driverStandings: driverData.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [],
        constructorStandings: constructorData.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [],
    };
}

// Rounds strictly before `uptoRound` in this season, most recent first —
// never includes the race being predicted. Cache key matches
// grandprixController.js's own results cache exactly (`results:${year}:
// ${round}`, same TTL.HISTORICAL) so a Race Hub visit and a Predictor
// visit for the same round share one cache entry instead of two.
async function fetchRecentResults(season, uptoRound, count) {
    const rounds = [];
    for (let r = uptoRound - 1; r >= 1 && rounds.length < count; r--) rounds.push(r);
    if (rounds.length === 0) return [];

    const results = await Promise.all(
        rounds.map((round) =>
            cached(`results:${season}:${round}`, TTL.HISTORICAL, () => getJson(`/${season}/${round}/results.json`))
                .then((data) => ({ round, results: data.MRData.RaceTable.Races[0]?.Results || [] }))
                .catch(() => ({ round, results: [] }))
        )
    );
    return results;
}

// Short TTL (not HISTORICAL) — this is called for the round currently
// being predicted, which may still be pre-qualifying; once the session
// genuinely finishes, the real result should show up within a few
// minutes rather than being blocked by a stale empty cache entry.
async function fetchQualifying(season, round) {
    try {
        const data = await cached(`predictor:qualifying:${season}:${round}`, TTL.QUALIFYING, () => getJson(`/${season}/${round}/qualifying.json`));
        return data.MRData.RaceTable.Races[0]?.QualifyingResults || [];
    } catch {
        return [];
    }
}

// Sprint weekends have their own results.json-shaped endpoint. Only ever
// called when the race genuinely has a sprint (race.Sprint present) — an
// empty return on a sprint weekend means "hasn't run yet", not "no sprint".
async function fetchSprintResults(season, round) {
    try {
        const data = await cached(`predictor:sprint:${season}:${round}`, TTL.QUALIFYING, () => getJson(`/${season}/${round}/sprint.json`));
        return data.MRData.RaceTable.Races[0]?.SprintResults || [];
    } catch {
        return [];
    }
}

// All-time results at this circuit, most recent editions only (see
// two-step fetch below — we learn the total row count first so we can
// request the TAIL of the chronological list rather than the oldest
// races, which matter less for "recent circuit history").
async function fetchCircuitHistory(circuitId) {
    if (!circuitId) return [];
    try {
        const probe = await cached(`predictor:circuit-probe:${circuitId}`, TTL.HISTORICAL, () => getJson(`/circuits/${circuitId}/results.json?limit=1`));
        const total = Number(probe.MRData.total) || 0;
        if (total === 0) return [];
        const limit = 220; // ~10 most recent race editions' worth of result rows
        const offset = Math.max(0, total - limit);
        const data = await cached(`predictor:circuit-history:${circuitId}`, TTL.HISTORICAL, () => getJson(`/circuits/${circuitId}/results.json?limit=${limit}&offset=${offset}`));
        return data.MRData.RaceTable.Races || [];
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// Feature engineering — each returns { score (0-1 or null), available, ...raw }
// ---------------------------------------------------------------------------

/*
 * Blends ordinal rank with points share (this entrant's points over the
 * leader's), 40/60. Rank alone treats a 1-point gap and a 200-point gap
 * between P1/P2 identically, throwing away real signal the standings
 * already carry; points share alone collapses everyone still on zero
 * points (common for the tail of the field, especially early season) to
 * an indistinguishable 0, losing their relative classification order.
 * Blending keeps both: genuine gap size where points exist, real rank
 * separation where they don't.
 */
function rankAndPointsShareScore(position, points, fieldSize, leaderPoints) {
    const rankScore = (fieldSize - position + 1) / fieldSize;
    const shareScore = leaderPoints > 0 ? points / leaderPoints : rankScore;
    return clamp01(rankScore * 0.4 + shareScore * 0.6);
}

function computeChampionshipFeature(standing, fieldSize, leaderPoints) {
    if (!standing || !fieldSize) return { score: null, available: false, position: null, points: null };
    const position = Number(standing.position);
    const points = Number(standing.points);
    return { score: rankAndPointsShareScore(position, points, fieldSize, leaderPoints), available: true, position, points };
}

function computeConstructorFeature(standing, fieldSize, leaderPoints) {
    if (!standing || !fieldSize) return { score: null, available: false, position: null, points: null };
    const position = Number(standing.position);
    const points = Number(standing.points);
    return { score: rankAndPointsShareScore(position, points, fieldSize, leaderPoints), available: true, position, points };
}

/*
 * Recent form = weighted average of a per-race score across up to the
 * last RECENT_FORM_RACE_COUNT races, most recent race weighted highest.
 * Weights for races 1..N back: [5, 4, 3, 2, 1] (normalized) — a simple
 * linear recency decay, chosen for transparency over a fitted decay
 * curve that would need held-out data to justify.
 *
 * Each individual race's score blends:
 *   50% finishing position (inverted, 1st = 1.0, last = ~0)
 *   30% points scored that race (points / 25, capped at 1.0)
 *   20% podium bonus (1.0 if P1-P3, else 0)
 * Finishing position uses the FIELD SIZE of that specific race (grids
 * vary in size year to year) and a non-finish (status not "Finished" or
 * "+N Lap(s)") is scored using the classified position Jolpica still
 * assigns (F1 classifies retirees who completed enough of the race) —
 * only genuine non-classifications fall back to a 0 for that race.
 */
function computeRecentFormFeature(driverId, recentRaces) {
    const races = recentRaces
        .map((r) => ({ round: r.round, result: r.results.find((res) => res.Driver.driverId === driverId), fieldSize: r.results.length }))
        .filter((r) => r.result);

    if (races.length === 0) return { score: null, available: false, racesUsed: 0 };

    // fetchRecentResults returns most-recent-first, so races[0] is the
    // most recent race and should get the highest weight.
    const recencyWeights = races.map((_, i) => races.length - i);

    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < races.length; i++) {
        const { result, fieldSize } = races[i];
        const pos = Number(result.position);
        const positionScore = fieldSize > 1 && !Number.isNaN(pos) ? clamp01((fieldSize - pos) / (fieldSize - 1)) : 0;
        const pointsScore = clamp01(Number(result.points) / 25);
        const podiumScore = pos <= 3 ? 1 : 0;
        const raceScore = positionScore * 0.5 + pointsScore * 0.3 + podiumScore * 0.2;

        const w = recencyWeights[i];
        weightedSum += raceScore * w;
        weightTotal += w;
    }

    return { score: clamp01(weightedSum / weightTotal), available: true, racesUsed: races.length };
}

/*
 * Circuit history uses ALL-TIME results at this track (see
 * fetchCircuitHistory, which returns editions oldest-first). Grid
 * position is used as a proxy for qualifying performance here rather
 * than a separate qualifying.json call per past race at this circuit —
 * cheaper, and grid position (post-penalties) is close enough to "how
 * they qualified" for a historical-trend feature. A driver with zero
 * prior starts gets a NEUTRAL 0.5, never a fabricated score — new/
 * rookie drivers are common and this must not penalize or favor them
 * without real data.
 *
 * Recency-weighted, not a flat average: a driver's form at this circuit
 * two seasons ago says far more about their current competitiveness
 * there than a result from a decade earlier under a different car/
 * regulation era, so later editions (higher index in the already-
 * chronological circuitRaces list) count proportionally more — the same
 * linear recency decay computeRecentFormFeature already uses for
 * same-season form, applied here across editions instead of rounds.
 */
function computeCircuitHistoryFeature(driverId, circuitRaces) {
    const entries = [];
    circuitRaces.forEach((race, editionIndex) => {
        const result = race.Results?.find((r) => r.Driver.driverId === driverId);
        if (result) entries.push({ result, editionIndex });
    });

    if (entries.length === 0) {
        return { score: 0.5, available: false, starts: 0, avgFinish: null, avgStart: null, podiums: 0, wins: 0 };
    }

    const finishes = [];
    const starts = [];
    let weightedFinishSum = 0;
    let weightTotal = 0;
    for (const { result, editionIndex } of entries) {
        const finish = Number(result.position);
        if (!Number.isNaN(finish)) {
            finishes.push(finish);
            const w = editionIndex + 1; // later edition = more recent = higher weight
            weightedFinishSum += finish * w;
            weightTotal += w;
        }
        const grid = Number(result.grid);
        if (!Number.isNaN(grid) && grid > 0) starts.push(grid);
    }

    const avgFinish = weightTotal > 0 ? weightedFinishSum / weightTotal : null;
    const avgStart = starts.length ? starts.reduce((a, b) => a + b, 0) / starts.length : null;
    const podiums = finishes.filter((p) => p <= 3).length;
    const wins = finishes.filter((p) => p === 1).length;

    // Normalize average finish against a typical modern grid size (20).
    const score = avgFinish !== null ? clamp01((20 - avgFinish) / 19) : 0.5;

    return { score, available: true, starts: entries.length, avgFinish, avgStart, podiums, wins };
}

function computeQualifyingFeature(driverId, qualifyingResults, teammateId) {
    if (!qualifyingResults || qualifyingResults.length === 0) {
        return { score: null, available: false, position: null, teammateDelta: null };
    }
    const result = qualifyingResults.find((q) => q.Driver.driverId === driverId);
    if (!result) return { score: null, available: false, position: null, teammateDelta: null };

    const fieldSize = qualifyingResults.length;
    const position = Number(result.position);
    const gridScore = clamp01((fieldSize - position) / (fieldSize - 1));

    // Out-qualifying a teammate in (near-)identical machinery is a real,
    // car-independent skill signal that grid position alone can't isolate
    // — bounded to a small +/-0.08 nudge so it can't override the actual
    // grid-position score, just adjust it.
    let teammateDelta = null;
    let teammateBonus = 0;
    if (teammateId) {
        const teammateResult = qualifyingResults.find((q) => q.Driver.driverId === teammateId);
        if (teammateResult) {
            teammateDelta = Number(teammateResult.position) - position; // positive = ahead of teammate
            teammateBonus = Math.max(-0.08, Math.min(0.08, (teammateDelta / fieldSize) * 0.8));
        }
    }

    return { score: clamp01(gridScore + teammateBonus), available: true, position, teammateDelta };
}

function clamp01(n) {
    if (Number.isNaN(n) || n === null || n === undefined) return 0;
    return Math.max(0, Math.min(1, n));
}

/*
 * Combines features into one 0-1 "strength" score using the given stage's
 * weights (see STAGE_BASELINES — one feature carries all the weight per
 * stage). When qualifying hasn't happened yet, its weight is redistributed
 * proportionally across the remaining available features rather than
 * treating a missing qualifying feature as a 0 (which would wrongly
 * punish every driver equally before quali even exists).
 */
function combineFeatures(features, weights) {
    // Only qualifying is ever conditionally excluded; the other four are
    // always present (championship/constructor standings always exist
    // once a season has a classified entrant, recentForm/circuitHistory
    // degrade to neutral defaults rather than becoming unavailable).
    const usableWeights = {};
    let total = 0;
    for (const [key, weight] of Object.entries(weights)) {
        if (key === "qualifying" && !features.qualifying?.available) continue;
        usableWeights[key] = weight;
        total += weight;
    }
    // POST_QUALIFYING's validated weighting puts everything on qualifying —
    // if that fetch unexpectedly comes back empty despite qualifying having
    // genuinely happened (a transient Jolpica gap), every weight is 0 and
    // there'd be nothing to rank by. Fall back to championship standing,
    // which is always available once a season has classified entrants,
    // rather than divide by zero or rank the whole field identically.
    if (total === 0) {
        usableWeights.championshipStanding = 1;
        total = 1;
    }
    for (const key of Object.keys(usableWeights)) usableWeights[key] = usableWeights[key] / total;

    let composite = 0;
    for (const [key, weight] of Object.entries(usableWeights)) {
        const score = features[key]?.score;
        composite += (score ?? 0.5) * weight;
    }
    return clamp01(composite);
}

// ---------------------------------------------------------------------------
// Plackett-Luce Monte Carlo simulation — turns strength scores into a full
// probability distribution over finishing positions.
//
// Method: an "ability" value is derived from each driver's strength score
// via ability = e^(k * strength), k = 4. The exponential keeps abilities
// strictly positive (required for Plackett-Luce) and spreads out the
// field more than a raw linear score would — a driver scoring 0.9 should
// be meaningfully more likely to win than one scoring 0.7, not just
// marginally so. k = 4 is a documented choice, not a fitted one (see
// LIMITATIONS).
//
// Each simulated race: repeatedly pick the next finisher from the
// remaining field with probability proportional to remaining ability
// (the standard Plackett-Luce sequential draw), until the full order is
// set. Doing this SIMULATION_TRIALS times and tallying how often each
// driver lands in each position gives real, methodology-derived
// probabilities — not arbitrary percentages.
// ---------------------------------------------------------------------------

function simulateRace(drivers) {
    const k = 4;
    const abilities = drivers.map((d) => Math.exp(k * d.strength));
    const n = drivers.length;

    const positionCounts = drivers.map(() => new Array(n).fill(0));
    const finishSums = new Array(n).fill(0);

    for (let trial = 0; trial < SIMULATION_TRIALS; trial++) {
        const remaining = drivers.map((_, i) => i);
        const remainingAbility = abilities.slice();
        let poolTotal = remainingAbility.reduce((a, b) => a + b, 0);

        for (let position = 0; position < n; position++) {
            let r = Math.random() * poolTotal;
            let pick = 0;
            for (; pick < remaining.length; pick++) {
                r -= remainingAbility[pick];
                if (r <= 0) break;
            }
            pick = Math.min(pick, remaining.length - 1);

            const driverIndex = remaining[pick];
            positionCounts[driverIndex][position] += 1;
            finishSums[driverIndex] += position + 1;

            poolTotal -= remainingAbility[pick];
            remaining.splice(pick, 1);
            remainingAbility.splice(pick, 1);
        }
    }

    return drivers.map((d, i) => {
        const counts = positionCounts[i];
        const win = counts[0] / SIMULATION_TRIALS;
        const podium = counts.slice(0, 3).reduce((a, b) => a + b, 0) / SIMULATION_TRIALS;
        const top5 = counts.slice(0, 5).reduce((a, b) => a + b, 0) / SIMULATION_TRIALS;
        const top10 = counts.slice(0, Math.min(10, n)).reduce((a, b) => a + b, 0) / SIMULATION_TRIALS;
        const expectedFinish = finishSums[i] / SIMULATION_TRIALS;
        return { ...d, winProbability: win, podiumProbability: podium, top5Probability: top5, top10Probability: top10, expectedFinish };
    });
}

function confidenceFor(features) {
    const available = ["championshipStanding", "recentForm", "constructorStrength", "circuitHistory", "qualifying"]
        .filter((key) => features[key]?.available).length;
    if (available >= 4) return "high";
    if (available >= 2) return "medium";
    return "low";
}

// ---------------------------------------------------------------------------
// Persistence (Phase 14) — a prediction is saved once, at the moment it is
// generated, so evaluation later reads back what genuinely existed before
// the race rather than anything recomputed after the fact. Upserted by
// (season, round, stage) so repeated cache-hits don't create duplicate
// writes. Never blocks or fails the response — persistence is a side
// effect, not something the upcoming-prediction screen depends on.
// ---------------------------------------------------------------------------

async function persistPrediction(result, source) {
    try {
        await RacePrediction.findOneAndUpdate(
            { season: result.race.season, round: result.race.round, stage: result.stage },
            {
                season: result.race.season,
                round: result.race.round,
                raceName: result.race.name,
                circuit: result.race.circuit,
                circuitId: result.race.circuitId,
                raceDate: result.race.date,
                country: result.race.country,
                qualifyingDate: result.race.qualifyingDate,
                sprintDate: result.race.sprintDate,
                hasSprint: result.race.hasSprint,
                stage: result.stage,
                baseline: result.baseline,
                source,
                modelName: result.model.name,
                modelVersion: result.model.version,
                weights: result.weights,
                dataAvailability: result.dataAvailability,
                limitations: result.limitations,
                generatedAt: result.generatedAt,
                predictions: result.predictions.map((p) => ({
                    driverId: p.driverId,
                    driverName: p.driverName,
                    driverCode: p.driverCode,
                    driverNumber: p.driverNumber,
                    constructorId: p.constructorId,
                    constructorName: p.constructorName,
                    predictedPosition: p.predictedPosition,
                    expectedFinish: p.expectedFinish,
                    winProbability: p.winProbability,
                    podiumProbability: p.podiumProbability,
                    top5Probability: p.top5Probability,
                    top10Probability: p.top10Probability,
                    confidence: p.confidence,
                })),
            },
            { upsert: true, returnDocument: "after" }
        );
    } catch (error) {
        console.error(`[Predictor] Failed to persist prediction: ${error.message}`);
    }
}

/*
 * A prediction is a historical record, not something to regenerate on
 * every page view — a stored doc for this exact race+stage IS the
 * prediction that existed for it, whether it's being served 10 seconds
 * or 10 days after generation. Reused by buildPrediction() (Part 2:
 * "if a prediction already exists, load it") so a page refresh doesn't
 * fire a fresh ~10-request Jolpica burst for data that hasn't changed.
 */
// Reshapes a stored Mongo doc into the API-facing prediction shape. Shared
// by loadStoredPrediction (the upcoming race) and evaluationService.js's
// getRacePrediction (any specific past race the user selects) so there is
// exactly one place that knows how a stored doc maps onto the page's data
// shape — never two copies drifting apart.
function shapeStoredDoc(doc) {
    // Older documents (predating Phase 20) never stored a `baseline` —
    // derive it from the doc's own stage so a historical prediction still
    // shows a sensible "why" rather than an empty field.
    const baseline = doc.baseline || STAGE_BASELINES[doc.stage] || null;
    return {
        race: {
            season: doc.season,
            round: doc.round,
            name: doc.raceName,
            circuit: doc.circuit,
            circuitId: doc.circuitId,
            country: doc.country ?? null,
            date: doc.raceDate,
            qualifyingDate: doc.qualifyingDate ?? null,
            sprintDate: doc.sprintDate ?? null,
            hasSprint: Boolean(doc.hasSprint),
        },
        stage: doc.stage,
        baseline: baseline ? { key: baseline.key, label: baseline.label, reason: baseline.reason } : null,
        // Only the keys the Data Used card reads — older documents may
        // still carry the retired weatherForecast/pitStopStrategy/
        // tyreCompounds keys, which are simply not copied forward. No
        // model/version/stage/generatedAt/limitations here either —
        // none of that is read by anything on the page anymore.
        dataAvailability: {
            historicalStandings: doc.dataAvailability?.historicalStandings,
            currentSeasonData: doc.dataAvailability?.currentSeasonData,
            circuitHistory: doc.dataAvailability?.circuitHistory,
            qualifying: doc.dataAvailability?.qualifying,
            ...(doc.dataAvailability?.sprintPerformance ? { sprintPerformance: doc.dataAvailability.sprintPerformance } : {}),
        },
        // Explicit field list rather than a passthrough — an older
        // document can still carry a legacy `factors` blob (retired
        // along with "Why This Prediction?"); never round-trip that.
        predictions: doc.predictions.map((p) => ({
            driverId: p.driverId,
            driverName: p.driverName,
            driverCode: p.driverCode,
            driverNumber: p.driverNumber ?? null,
            constructorName: p.constructorName,
            constructorId: p.constructorId,
            predictedPosition: p.predictedPosition,
            expectedFinish: p.expectedFinish,
            winProbability: p.winProbability,
            podiumProbability: p.podiumProbability,
            top5Probability: p.top5Probability,
            top10Probability: p.top10Probability,
            confidence: p.confidence,
        })),
    };
}

async function loadStoredPrediction(season, round, stage) {
    try {
        const doc = await RacePrediction.findOne({ season: String(season), round: Number(round), stage }).lean();
        if (!doc) return null;
        return shapeStoredDoc(doc);
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Shared assembly — turns fetched data into the final prediction shape.
// Used by both buildPrediction() (the real upcoming race, "live") and
// buildBacktestPrediction() (a past completed race, reconstructed with
// data scoped strictly to before that race — "backtest"). Identical
// feature engineering and simulation either way; only the data sources
// feeding it differ.
// ---------------------------------------------------------------------------

function assemblePrediction({ season, round, race, circuitId, stage, qualifyingCompleted, sprintCompleted, driverStandings, constructorStandings, recentRaces, circuitRaces, qualifyingResults, sprintResults }) {
    // See predictionDataPolicy.js — the one enforced gate every prediction
    // (live or backtest) passes through before any qualifying/sprint data
    // can reach a feature. For PRE_QUALIFYING this strips qualifyingResults
    // even if a caller passed real ones in; today's callers never do, but
    // the guarantee now lives here structurally, not by convention.
    ({ qualifyingResults, sprintResults } = sanitizeStageInputs(stage, { qualifyingResults, sprintResults }));

    const baseline = STAGE_BASELINES[stage] || STAGE_BASELINES.pre_qualifying;

    const fieldSize = driverStandings.length;
    const constructorFieldSize = constructorStandings.length;
    const constructorStandingByTeam = new Map(constructorStandings.map((c) => [c.Constructor.constructorId, c]));
    // Standings are already sorted by position ascending, so index 0 is
    // the leader — used to score every other entrant's points as a real
    // gap, not just an ordinal rank (see rankAndPointsShareScore).
    const leaderPoints = Number(driverStandings[0]?.points) || 0;
    const constructorLeaderPoints = Number(constructorStandings[0]?.points) || 0;

    // Teammate lookup for the qualifying-delta feature.
    const teamRoster = new Map();
    for (const s of driverStandings) {
        const teamId = s.Constructors?.[0]?.constructorId;
        if (!teamId) continue;
        if (!teamRoster.has(teamId)) teamRoster.set(teamId, []);
        teamRoster.get(teamId).push(s.Driver.driverId);
    }

    // A sprint result is this weekend's own recent-race data, even more
    // current than any past round — prepended so computeRecentFormFeature's
    // existing recency weighting (index 0 = highest weight) naturally
    // gives it the top slot, rather than adding a whole separate scored
    // feature for something that's really just "how did this driver do
    // very recently". Its points use the same /25 normalization real
    // races do, which already down-weights a sprint's lower point scale
    // relative to a full race — exactly the right amount of influence.
    const recentRacesWithSprint = sprintResults.length > 0
        ? [{ round: `${round}-sprint`, results: sprintResults }, ...recentRaces]
        : recentRaces;

    const withFeatures = driverStandings.map((s) => {
        const driverId = s.Driver.driverId;
        const teamId = s.Constructors?.[0]?.constructorId;
        const teammateId = (teamRoster.get(teamId) || []).find((id) => id !== driverId) || null;

        const championshipStanding = computeChampionshipFeature(s, fieldSize, leaderPoints);
        const constructorStrength = computeConstructorFeature(constructorStandingByTeam.get(teamId), constructorFieldSize, constructorLeaderPoints);
        const recentForm = computeRecentFormFeature(driverId, recentRacesWithSprint);
        const circuitHistory = computeCircuitHistoryFeature(driverId, circuitRaces);
        const qualifying = computeQualifyingFeature(driverId, qualifyingResults, teammateId);

        const features = { championshipStanding, constructorStrength, recentForm, circuitHistory, qualifying };
        const strength = combineFeatures(features, baseline.weights);

        return {
            driverId,
            driverName: `${s.Driver.givenName} ${s.Driver.familyName}`,
            driverCode: s.Driver.code ?? null,
            driverNumber: s.Driver.permanentNumber ?? null,
            constructorId: teamId ?? null,
            constructorName: s.Constructors?.[0]?.name ?? null,
            strength,
            features,
        };
    });

    const simulated = simulateRace(withFeatures);
    simulated.sort((a, b) => a.expectedFinish - b.expectedFinish);

    const predictions = simulated.map((d, i) => ({
        driverId: d.driverId,
        driverName: d.driverName,
        driverCode: d.driverCode,
        driverNumber: d.driverNumber,
        constructorName: d.constructorName,
        constructorId: d.constructorId,
        predictedPosition: i + 1,
        expectedFinish: Number(d.expectedFinish.toFixed(2)),
        winProbability: round2(d.winProbability),
        podiumProbability: round2(d.podiumProbability),
        top5Probability: round2(d.top5Probability),
        top10Probability: round2(d.top10Probability),
        confidence: confidenceFor(d.features),
    }));

    const result = {
        race: {
            season,
            round,
            name: race.raceName,
            circuit: race.Circuit?.circuitName ?? null,
            circuitId,
            country: race.Circuit?.Location?.country ?? null,
            date: race.date,
            qualifyingDate: race.Qualifying?.date ?? null,
            sprintDate: race.Sprint?.date ?? null,
            hasSprint: Boolean(race.Sprint),
        },
        stage,
        // Identifies which validated baseline actually drove the ranking for
        // this stage (see STAGE_BASELINES) — the UI's explanation of "why
        // this prediction" reads directly from here, not from `weights`.
        baseline: { key: baseline.key, label: baseline.label, reason: baseline.reason },
        generatedAt: new Date().toISOString(),
        model: { name: MODEL_NAME, version: MODEL_VERSION },
        weights: baseline.weights,
        // Each entry is a genuine status, not a plain yes/no: "pending" means
        // the data hasn't happened yet (never an integration failure), and
        // "unavailable" is reserved for data that should exist but couldn't
        // be fetched — never used just because a provider isn't integrated.
        // Only the sources the Data Used card can actually surface — no
        // weather/pit-stop/tyre-compound keys, since nothing computes those
        // anymore (see the removed fetchRaceWeather/fetchPitStops).
        dataAvailability: {
            historicalStandings: { status: "available" },
            currentSeasonData: { status: recentRaces.length > 0 ? "available" : "unavailable" },
            circuitHistory: { status: circuitRaces.length > 0 ? "available" : "unavailable" },
            qualifying: {
                status: !qualifyingCompleted ? "pending" : qualifyingResults.length > 0 ? "available" : "unavailable",
            },
            // Only present at all on a sprint weekend — a normal weekend has
            // no sprint to report on, so the Data Used card should not show
            // this row rather than claim it's "not available".
            ...(race.Sprint
                ? { sprintPerformance: { status: !sprintCompleted ? "pending" : sprintResults.length > 0 ? "available" : "unavailable" } }
                : {}),
        },
        predictions,
        limitations: LIMITATIONS,
    };

    return result;
}

// ---------------------------------------------------------------------------
// Orchestrators
// ---------------------------------------------------------------------------

let inFlightRequest = null;

/*
 * Guards against duplicate simultaneous prediction requests (Part 1) —
 * e.g. React StrictMode's double-invoked effect, a fast double page
 * load, or two browser tabs open at once. Without this, two concurrent
 * calls would each independently fire their own full Jolpica burst;
 * with it, the second caller just awaits the first one's in-flight
 * promise instead.
 */
async function buildPrediction() {
    if (inFlightRequest) return inFlightRequest;
    inFlightRequest = buildPredictionInternal().finally(() => {
        inFlightRequest = null;
    });
    return inFlightRequest;
}

async function buildPredictionInternal() {
    const race = await fetchUpcomingRace();
    if (!race) return { error: "no_upcoming_race" };

    const season = race.season;
    const round = Number(race.round);
    const circuitId = race.Circuit?.circuitId ?? null;

    const now = new Date();
    const qualifyingDateTime = race.Qualifying ? new Date(`${race.Qualifying.date}T${race.Qualifying.time || "00:00:00Z"}`) : null;
    const qualifyingCompleted = Boolean(qualifyingDateTime && now >= qualifyingDateTime);
    const stage = qualifyingCompleted ? STAGES.POST_QUALIFYING : STAGES.PRE_QUALIFYING;
    const sprintDateTime = race.Sprint ? new Date(`${race.Sprint.date}T${race.Sprint.time || "00:00:00Z"}`) : null;
    const sprintCompleted = Boolean(sprintDateTime && now >= sprintDateTime);

    const cacheKey = `${season}-${round}-${stage}`;
    if (cache.key === cacheKey && cache.expiresAt > Date.now()) {
        return cache.result;
    }

    // Part 2 — a stored prediction for this exact race+stage already
    // exists means there's nothing to regenerate: load it instead of
    // firing a fresh Jolpica burst for data that hasn't changed.
    const stored = await loadStoredPrediction(season, round, stage);
    if (stored) {
        cache = { key: cacheKey, expiresAt: Date.now() + CACHE_TTL_MS, result: stored };
        return stored;
    }

    const { driverStandings, constructorStandings } = await fetchStandings(season);
    if (driverStandings.length === 0) {
        return { error: "insufficient_historical_data" };
    }

    const [recentRaces, circuitRaces, qualifyingResults, sprintResults] = await Promise.all([
        fetchRecentResults(season, round, RECENT_FORM_RACE_COUNT),
        fetchCircuitHistory(circuitId),
        qualifyingCompleted ? fetchQualifying(season, round) : Promise.resolve([]),
        race.Sprint && sprintCompleted ? fetchSprintResults(season, round) : Promise.resolve([]),
    ]);

    const result = assemblePrediction({
        season, round, race, circuitId, stage, qualifyingCompleted, sprintCompleted,
        driverStandings, constructorStandings, recentRaces, circuitRaces, qualifyingResults, sprintResults,
    });

    // persistPrediction still needs the full internal shape (model,
    // weights, generatedAt, limitations — the historical record); none of
    // that goes out over the API, which only ever gets what the page
    // actually reads. stage/baseline DO go out — the UI needs them to
    // show which validated baseline produced this prediction and why.
    persistPrediction(result, "live");
    const apiResult = {
        race: result.race,
        stage: result.stage,
        baseline: result.baseline,
        dataAvailability: result.dataAvailability,
        predictions: result.predictions,
    };

    cache = { key: cacheKey, expiresAt: Date.now() + CACHE_TTL_MS, result: apiResult };
    return apiResult;
}

/*
 * Reconstructs what the model would have predicted for a PAST completed
 * race, using ONLY data that genuinely existed before that race:
 *   - standings AS OF the previous round (Jolpica's round-scoped
 *     standings endpoint — verified to return a real historical
 *     snapshot, not the current/final standings)
 *   - recent-form results from rounds strictly before this one
 *     (fetchRecentResults already enforces this)
 *   - circuit history (a different race entirely by construction)
 *   - that race's REAL qualifying result, which genuinely happened
 *     before the race itself, so using it is not leakage
 * This is Phase 12's own documented intent (see the module header) —
 * the feature functions were written to accept an explicit target round
 * specifically so this reuse would be leakage-safe. Tagged "backtest" so
 * it is never confused with a prediction genuinely captured in real time.
 */
async function buildBacktestPrediction(season, round) {
    const asOfRound = round - 1;
    if (asOfRound < 1) return { error: "no_prior_standings" };

    const [driverData, constructorData, raceData] = await Promise.all([
        cached(`predictor:standings-asof:${season}:${asOfRound}:driver`, TTL.HISTORICAL, () => getJson(`/${season}/${asOfRound}/driverstandings.json?limit=100`)).catch(() => null),
        cached(`predictor:standings-asof:${season}:${asOfRound}:constructor`, TTL.HISTORICAL, () => getJson(`/${season}/${asOfRound}/constructorstandings.json?limit=100`)).catch(() => null),
        cached(`predictor:race:${season}:${round}`, TTL.HISTORICAL, () => getJson(`/${season}/${round}.json`)),
    ]);

    const race = raceData.MRData.RaceTable.Races[0];
    if (!race) return { error: "race_not_found" };

    const driverStandings = driverData?.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
    const constructorStandings = constructorData?.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];
    if (driverStandings.length === 0) return { error: "insufficient_historical_data" };

    const circuitId = race.Circuit?.circuitId ?? null;
    const [recentRaces, circuitRaces, qualifyingResults, sprintResults] = await Promise.all([
        fetchRecentResults(season, round, RECENT_FORM_RACE_COUNT),
        fetchCircuitHistory(circuitId),
        fetchQualifying(season, round),
        race.Sprint ? fetchSprintResults(season, round) : Promise.resolve([]),
    ]);

    const result = assemblePrediction({
        season, round, race, circuitId,
        stage: STAGES.POST_QUALIFYING,
        qualifyingCompleted: true,
        sprintCompleted: true,
        driverStandings, constructorStandings, recentRaces, circuitRaces, qualifyingResults, sprintResults,
    });

    await persistPrediction(result, "backtest");
    return result;
}

function round2(n) {
    return Math.round(n * 1000) / 1000;
}

module.exports = {
    buildPrediction,
    buildBacktestPrediction,
    shapeStoredDoc,
    // Additive-only, for Phase 2's backtestDatasetService — the exact same
    // leakage-safe fetch/feature functions this file already uses for live
    // and backtest predictions, reused as-is (never re-implemented) so the
    // historical dataset's features are computed identically to the real
    // predictor's. Nothing above this line changed to make these available.
    RECENT_FORM_RACE_COUNT,
    fetchStandings,
    fetchRecentResults,
    fetchQualifying,
    fetchSprintResults,
    fetchCircuitHistory,
    computeChampionshipFeature,
    computeConstructorFeature,
    computeRecentFormFeature,
    computeCircuitHistoryFeature,
    computeQualifyingFeature,
    // Additive-only, Phase 20 — exposed for sanity-checking the validated
    // baseline weighting directly (no network calls required) rather than
    // only indirectly through a full buildPrediction()/buildBacktestPrediction() run.
    STAGE_BASELINES,
    combineFeatures,
    assemblePrediction,
};
