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
 *   - circuits/{circuitId}/results.json → all-time results at this track
 *
 * FEATURES (per driver, each normalized to roughly 0–1, higher = better)
 *   championshipStanding — current standings position, inverted+scaled
 *   recentForm           — weighted avg of the last up to 5 races
 *                           (see computeRecentFormFeature)
 *   constructorStrength  — constructor's standings position, inverted
 *   circuitHistory        — driver's all-time record at this circuit
 *   qualifying            — this weekend's grid position, ONLY once
 *                           qualifying has actually happened
 *
 * WEIGHTS (documented, not tuned against held-out data — see
 * LIMITATIONS)
 *   recentForm: 0.35, qualifying: 0.25, constructorStrength: 0.20,
 *   circuitHistory: 0.10, championshipStanding: 0.10
 *   Before qualifying, qualifying's weight is redistributed
 *   proportionally across the other four rather than guessed at.
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
 * CACHING + PERSISTENCE (Phase 14)
 * An in-memory cache keyed by `${season}-${round}-${stage}` avoids
 * recomputing (and re-hitting Jolpica ~10-15 times) on every request to
 * GET /api/predictor/upcoming; it's invalidated by TTL and by the
 * pre/post-qualifying stage actually changing. Separately, every
 * successfully generated prediction (both the real "live" upcoming one
 * and any reconstructed "backtest" one) is persisted to the
 * RacePrediction Mongo model — that's what makes Phase 14 evaluation
 * possible: it reads back the prediction that genuinely existed before
 * a race, rather than ever recomputing one after the fact.
 */

const { getJson } = require("./jolpicaClient");
const { getForecast } = require("./weatherService");
const RacePrediction = require("../models/RacePrediction");

const MODEL_NAME = "AllAboutF1 Weighted Power-Rank + Plackett-Luce Simulation";
const MODEL_VERSION = "1.0.0";

const RECENT_FORM_RACE_COUNT = 5;
const SIMULATION_TRIALS = 5000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const WEIGHTS = {
    recentForm: 0.35,
    qualifying: 0.25,
    constructorStrength: 0.2,
    circuitHistory: 0.1,
    championshipStanding: 0.1,
};

// ---------------------------------------------------------------------------
// In-memory cache — see "CACHING" above
// ---------------------------------------------------------------------------

let cache = { key: null, expiresAt: 0, result: null };

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

async function fetchUpcomingRace() {
    const data = await getJson("/current/next.json");
    return data.MRData.RaceTable.Races[0] || null;
}

async function fetchStandings(season) {
    const [driverData, constructorData] = await Promise.all([
        getJson(`/${season}/driverstandings.json?limit=100`),
        getJson(`/${season}/constructorstandings.json?limit=100`),
    ]);
    return {
        driverStandings: driverData.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [],
        constructorStandings: constructorData.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [],
    };
}

// Rounds strictly before `uptoRound` in this season, most recent first —
// never includes the race being predicted.
async function fetchRecentResults(season, uptoRound, count) {
    const rounds = [];
    for (let r = uptoRound - 1; r >= 1 && rounds.length < count; r--) rounds.push(r);
    if (rounds.length === 0) return [];

    const results = await Promise.all(
        rounds.map((round) =>
            getJson(`/${season}/${round}/results.json`)
                .then((data) => ({ round, results: data.MRData.RaceTable.Races[0]?.Results || [] }))
                .catch(() => ({ round, results: [] }))
        )
    );
    return results;
}

async function fetchQualifying(season, round) {
    try {
        const data = await getJson(`/${season}/${round}/qualifying.json`);
        return data.MRData.RaceTable.Races[0]?.QualifyingResults || [];
    } catch {
        return [];
    }
}

// Used only to confirm the historical source genuinely has pit-stop
// records for a recent round — a real availability check, not an
// assumption. Never used to infer tyre compounds, which Jolpica does not
// provide at all.
async function fetchPitStops(season, round) {
    try {
        const data = await getJson(`/${season}/${round}/pitstops.json?limit=100`);
        return data.MRData.RaceTable.Races[0]?.PitStops || [];
    } catch {
        return [];
    }
}

// Forecast for the upcoming race session itself — reuses the same
// Open-Meteo integration as the Race Hub's "Next Race Weather" (see
// weatherService.js), keyed off this race's own circuit coordinates
// (never hardcoded). Returns null when coordinates are missing or the
// race is further out than Open-Meteo's ~16-day forecast window; that's
// a genuine "not available yet", not a fabricated value.
async function fetchRaceWeather(race) {
    const location = race.Circuit?.Location;
    const lat = location?.lat != null ? Number(location.lat) : null;
    const lon = location?.long != null ? Number(location.long) : null;
    if (lat == null || lon == null || !race.date) return null;

    const targetIso = `${race.date}T${race.time || "00:00:00Z"}`;
    try {
        return await getForecast(lat, lon, targetIso);
    } catch {
        return null;
    }
}

// All-time results at this circuit, most recent editions only (see
// two-step fetch below — we learn the total row count first so we can
// request the TAIL of the chronological list rather than the oldest
// races, which matter less for "recent circuit history").
async function fetchCircuitHistory(circuitId) {
    if (!circuitId) return [];
    try {
        const probe = await getJson(`/circuits/${circuitId}/results.json?limit=1`);
        const total = Number(probe.MRData.total) || 0;
        if (total === 0) return [];
        const limit = 220; // ~10 most recent race editions' worth of result rows
        const offset = Math.max(0, total - limit);
        const data = await getJson(`/circuits/${circuitId}/results.json?limit=${limit}&offset=${offset}`);
        return data.MRData.RaceTable.Races || [];
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// Feature engineering — each returns { score (0-1 or null), available, ...raw }
// ---------------------------------------------------------------------------

function computeChampionshipFeature(standing, fieldSize) {
    if (!standing || !fieldSize) return { score: null, available: false, position: null, points: null };
    const position = Number(standing.position);
    const score = (fieldSize - position + 1) / fieldSize;
    return { score: clamp01(score), available: true, position, points: Number(standing.points) };
}

function computeConstructorFeature(standing, fieldSize) {
    if (!standing || !fieldSize) return { score: null, available: false, position: null, points: null };
    const position = Number(standing.position);
    const score = (fieldSize - position + 1) / fieldSize;
    return { score: clamp01(score), available: true, position, points: Number(standing.points) };
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
 * fetchCircuitHistory). Grid position is used as a proxy for qualifying
 * performance here rather than a separate qualifying.json call per past
 * race at this circuit — cheaper, and grid position (post-penalties) is
 * close enough to "how they qualified" for a historical-trend feature.
 * A driver with zero prior starts gets a NEUTRAL 0.5, never a fabricated
 * score — new/rookie drivers are common and this must not penalize or
 * favor them without real data.
 */
function computeCircuitHistoryFeature(driverId, circuitRaces) {
    const entries = [];
    for (const race of circuitRaces) {
        const result = race.Results?.find((r) => r.Driver.driverId === driverId);
        if (result) entries.push(result);
    }

    if (entries.length === 0) {
        return { score: 0.5, available: false, starts: 0, avgFinish: null, avgStart: null, podiums: 0, wins: 0 };
    }

    const finishes = entries.map((e) => Number(e.position)).filter((n) => !Number.isNaN(n));
    const starts = entries.map((e) => Number(e.grid)).filter((n) => !Number.isNaN(n) && n > 0);
    const avgFinish = finishes.length ? finishes.reduce((a, b) => a + b, 0) / finishes.length : null;
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
    const score = clamp01((fieldSize - position) / (fieldSize - 1));

    let teammateDelta = null;
    if (teammateId) {
        const teammateResult = qualifyingResults.find((q) => q.Driver.driverId === teammateId);
        if (teammateResult) teammateDelta = Number(teammateResult.position) - position; // positive = ahead of teammate
    }

    return { score, available: true, position, teammateDelta };
}

function clamp01(n) {
    if (Number.isNaN(n) || n === null || n === undefined) return 0;
    return Math.max(0, Math.min(1, n));
}

/*
 * Combines the five features into one 0-1 "strength" score. When
 * qualifying hasn't happened yet, its weight is redistributed
 * proportionally across the remaining available features rather than
 * treating a missing qualifying feature as a 0 (which would wrongly
 * punish every driver equally before quali even exists).
 */
function combineFeatures(features) {
    // Only qualifying is ever conditionally excluded; the other four are
    // always present (championship/constructor standings always exist
    // once a season has a classified entrant, recentForm/circuitHistory
    // degrade to neutral defaults rather than becoming unavailable).
    const usableWeights = {};
    let total = 0;
    for (const [key, weight] of Object.entries(WEIGHTS)) {
        if (key === "qualifying" && !features.qualifying?.available) continue;
        usableWeights[key] = weight;
        total += weight;
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
                stage: result.stage,
                source,
                modelName: result.model.name,
                modelVersion: result.model.version,
                weights: result.weights,
                dataAvailability: result.dataAvailability,
                generatedAt: result.generatedAt,
                predictions: result.predictions.map((p) => ({
                    driverId: p.driverId,
                    driverName: p.driverName,
                    driverCode: p.driverCode,
                    constructorId: p.constructorId,
                    constructor: p.constructor,
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

// ---------------------------------------------------------------------------
// Shared assembly — turns fetched data into the final prediction shape.
// Used by both buildPrediction() (the real upcoming race, "live") and
// buildBacktestPrediction() (a past completed race, reconstructed with
// data scoped strictly to before that race — "backtest"). Identical
// feature engineering and simulation either way; only the data sources
// feeding it differ.
// ---------------------------------------------------------------------------

function assemblePrediction({ season, round, race, circuitId, stage, qualifyingCompleted, driverStandings, constructorStandings, recentRaces, circuitRaces, qualifyingResults, weather = null, pitStopsAvailable = false }) {
    const fieldSize = driverStandings.length;
    const constructorFieldSize = constructorStandings.length;
    const constructorStandingByTeam = new Map(constructorStandings.map((c) => [c.Constructor.constructorId, c]));

    // Teammate lookup for the qualifying-delta feature.
    const teamRoster = new Map();
    for (const s of driverStandings) {
        const teamId = s.Constructors?.[0]?.constructorId;
        if (!teamId) continue;
        if (!teamRoster.has(teamId)) teamRoster.set(teamId, []);
        teamRoster.get(teamId).push(s.Driver.driverId);
    }

    const withFeatures = driverStandings.map((s) => {
        const driverId = s.Driver.driverId;
        const teamId = s.Constructors?.[0]?.constructorId;
        const teammateId = (teamRoster.get(teamId) || []).find((id) => id !== driverId) || null;

        const championshipStanding = computeChampionshipFeature(s, fieldSize);
        const constructorStrength = computeConstructorFeature(constructorStandingByTeam.get(teamId), constructorFieldSize);
        const recentForm = computeRecentFormFeature(driverId, recentRaces);
        const circuitHistory = computeCircuitHistoryFeature(driverId, circuitRaces);
        const qualifying = computeQualifyingFeature(driverId, qualifyingResults, teammateId);

        const features = { championshipStanding, constructorStrength, recentForm, circuitHistory, qualifying };
        const strength = combineFeatures(features);

        return {
            driverId,
            driverName: `${s.Driver.givenName} ${s.Driver.familyName}`,
            driverCode: s.Driver.code ?? null,
            constructorId: teamId ?? null,
            constructor: s.Constructors?.[0]?.name ?? null,
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
        constructor: d.constructor,
        constructorId: d.constructorId,
        predictedPosition: i + 1,
        expectedFinish: Number(d.expectedFinish.toFixed(2)),
        winProbability: round2(d.winProbability),
        podiumProbability: round2(d.podiumProbability),
        top5Probability: round2(d.top5Probability),
        top10Probability: round2(d.top10Probability),
        confidence: confidenceFor(d.features),
        factors: {
            recentForm: summarizeFeature(d.features.recentForm),
            qualifying: summarizeFeature(d.features.qualifying),
            constructorStrength: summarizeFeature(d.features.constructorStrength),
            circuitHistory: summarizeFeature(d.features.circuitHistory),
            championshipPosition: summarizeFeature(d.features.championshipStanding),
        },
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
        generatedAt: new Date().toISOString(),
        model: { name: MODEL_NAME, version: MODEL_VERSION },
        weights: WEIGHTS,
        // Each entry is a genuine status, not a plain yes/no: "pending" means
        // the data hasn't happened yet (never an integration failure),
        // "limited" means the source only partially covers that topic, and
        // "unavailable" is reserved for data that should exist but couldn't
        // be fetched — never used just because a provider isn't integrated.
        dataAvailability: {
            historicalStandings: { status: "available" },
            currentSeasonData: { status: recentRaces.length > 0 ? "available" : "unavailable" },
            circuitHistory: { status: circuitRaces.length > 0 ? "available" : "unavailable" },
            qualifying: {
                status: !qualifyingCompleted ? "pending" : qualifyingResults.length > 0 ? "available" : "unavailable",
            },
            weatherForecast: { status: weather ? "available" : "unavailable" },
            pitStopStrategy: { status: pitStopsAvailable ? "available" : "unavailable" },
            tyreCompounds: { status: "limited" },
        },
        weather,
        predictions,
        limitations: [
            "This is a statistical estimate from publicly available historical/current-season data, not a guarantee — F1 outcomes depend on many factors (incidents, weather, strategy, reliability) this model does not model.",
            "Weights and the simulation's ability transform (k=4) are documented, reasoned choices, not fitted against held-out historical results.",
            "Weather is shown as a forecast for the race session, sourced from Open-Meteo — it is not yet used as a scoring input to the prediction itself.",
            "Historical pit-stop counts and timing are available from the data source; tyre compounds are not, so compound/stint strategy is never shown or implied.",
            "Circuit history uses grid position as a proxy for qualifying position (avoids one qualifying.json fetch per past race at the circuit).",
        ],
    };

    return result;
}

// ---------------------------------------------------------------------------
// Orchestrators
// ---------------------------------------------------------------------------

async function buildPrediction() {
    const race = await fetchUpcomingRace();
    if (!race) return { error: "no_upcoming_race" };

    const season = race.season;
    const round = Number(race.round);
    const circuitId = race.Circuit?.circuitId ?? null;

    const now = new Date();
    const qualifyingDateTime = race.Qualifying ? new Date(`${race.Qualifying.date}T${race.Qualifying.time || "00:00:00Z"}`) : null;
    const qualifyingCompleted = Boolean(qualifyingDateTime && now >= qualifyingDateTime);
    const stage = qualifyingCompleted ? "post_qualifying" : "pre_qualifying";

    const cacheKey = `${season}-${round}-${stage}`;
    if (cache.key === cacheKey && cache.expiresAt > Date.now()) {
        return cache.result;
    }

    const { driverStandings, constructorStandings } = await fetchStandings(season);
    if (driverStandings.length === 0) {
        return { error: "insufficient_historical_data" };
    }

    const [recentRaces, circuitRaces, qualifyingResults] = await Promise.all([
        fetchRecentResults(season, round, RECENT_FORM_RACE_COUNT),
        fetchCircuitHistory(circuitId),
        qualifyingCompleted ? fetchQualifying(season, round) : Promise.resolve([]),
    ]);

    const result = assemblePrediction({
        season, round, race, circuitId, stage, qualifyingCompleted,
        driverStandings, constructorStandings, recentRaces, circuitRaces, qualifyingResults,
    });

    cache = { key: cacheKey, expiresAt: Date.now() + CACHE_TTL_MS, result };
    persistPrediction(result, "live");
    return result;
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
        getJson(`/${season}/${asOfRound}/driverstandings.json?limit=100`).catch(() => null),
        getJson(`/${season}/${asOfRound}/constructorstandings.json?limit=100`).catch(() => null),
        getJson(`/${season}/${round}.json`),
    ]);

    const race = raceData.MRData.RaceTable.Races[0];
    if (!race) return { error: "race_not_found" };

    const driverStandings = driverData?.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
    const constructorStandings = constructorData?.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [];
    if (driverStandings.length === 0) return { error: "insufficient_historical_data" };

    const circuitId = race.Circuit?.circuitId ?? null;
    const [recentRaces, circuitRaces, qualifyingResults] = await Promise.all([
        fetchRecentResults(season, round, RECENT_FORM_RACE_COUNT),
        fetchCircuitHistory(circuitId),
        fetchQualifying(season, round),
    ]);

    const result = assemblePrediction({
        season, round, race, circuitId,
        stage: "post_qualifying",
        qualifyingCompleted: true,
        driverStandings, constructorStandings, recentRaces, circuitRaces, qualifyingResults,
    });

    await persistPrediction(result, "backtest");
    return result;
}

function round2(n) {
    return Math.round(n * 1000) / 1000;
}

function summarizeFeature(feature) {
    if (!feature || !feature.available) return { available: false, score: feature?.score ?? null };
    const { score, ...rest } = feature;
    return { available: true, score: Number(score.toFixed(3)), ...rest };
}

module.exports = { buildPrediction, buildBacktestPrediction };
