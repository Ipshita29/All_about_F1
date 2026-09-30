/*
 * ═══════════════════════════════════════════════════════════════════
 * ML FEATURE ENGINEERING (Phase 3 of the accuracy-improvement plan)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Turns Phase 2's per-driver historical sample into a clean, FLAT,
 * NUMERIC feature vector suitable for actually training a model later.
 * This file computes features only — it trains nothing, changes no
 * prediction weight, and never touches the UI or the live predictor
 * (predictorService.js's buildPrediction/assemblePrediction are not
 * called or modified here).
 *
 * WHERE THIS SITS
 * backtestDatasetService.js (Phase 2) fetches every raw array this file
 * needs (recentRaces, circuitRaces, qualifyingResults, sprintResults,
 * teamRoster, standings) once per race and already computes a richer,
 * per-category "features" object from them (championshipStanding,
 * constructorStrength, recentForm, circuitHistory, driverVsTeammate,
 * reliability, sprint, qualifying). This file is called from INSIDE
 * that same per-driver loop, with those exact objects and raw arrays
 * passed in — no new Jolpica calls, no re-fetching, no re-deriving
 * anything Phase 2 already computed. Where a Phase 2 value is already
 * the right number (e.g. driverVsTeammate.avgPositionDelta), it is
 * reused as-is under a clearer ML-facing name. Only genuinely new
 * derivations (raw avg finish/points over a window, gap to pole,
 * constructor-level pooled stats, circuit's single most recent result)
 * are computed fresh here, from the same already-fetched arrays.
 *
 * LEAKAGE SAFETY
 * `recentRaces`/`circuitRaces` are already leakage-safe by construction
 * (see backtestDatasetService.js's own header) — this file only reads
 * them, never re-scopes them. The one thing THIS file must independently
 * enforce is the qualifying gate: Phase 2 already gates its own
 * `features.qualifying` object, but this file derives several NEW
 * qualifying-shaped numbers (gap to pole, constructor qualifying
 * average) that Phase 2 never computed, so `buildMLFeatureVector` passes
 * `qualifyingResults` through predictionDataPolicy's own
 * `sanitizeStageInputs(stage, ...)` itself, independently, before
 * deriving any of them. A PRE_QUALIFYING call therefore always
 * produces null/false for every qualifying-derived key below, exactly
 * matching Phase 1's rule ("PRE_QUALIFYING must never contain
 * qualifying-derived features") — not because the caller remembered to
 * omit them, but because the gated array is empty at that point.
 *
 * MISSING VALUES
 * Every feature is `null` when it genuinely cannot be computed (no
 * teammate this weekend, driver has never raced this circuit, fewer
 * than the required window of recent races exists, …) — never a
 * fabricated 0, average, or neutral placeholder. `mlFeatureAvailability`
 * mirrors `mlFeatures` key-for-key with a boolean, so a training
 * pipeline can distinguish "genuinely missing" from "a real low value"
 * without guessing from the number alone.
 *
 * WEATHER (Phase 3.5)
 * Open-Meteo's historical/archive API genuinely covers past F1 race
 * dates (confirmed live — see weatherService.getHistoricalWeather), so
 * weather is real, reused data here, not invented: `phase2.weather` is
 * the race-level reading backtestDatasetService.computeWeatherFeature
 * already fetched once per race. This file only flattens it into the
 * vector — a network failure or a date the archive has no data for
 * still comes through as null/unavailable, per phase2.weather.available.
 */

const { STAGES, sanitizeStageInputs } = require("./predictionDataPolicy");

// ---------------------------------------------------------------------------
// FEATURE_CATALOG — documents every key buildMLFeatureVector can produce:
// which requirement category it satisfies, and whether it is gated to
// POST_QUALIFYING or available at both stages. Not required at runtime;
// exported so a future training script (or this phase's own report) has
// one place that names every feature instead of inferring it from code.
// ---------------------------------------------------------------------------

const FEATURE_CATALOG = Object.freeze([
    { key: "championshipStandingScore", category: "championship", stage: "both", description: "Reused from Phase 2 championshipStanding.score (rank + points-share blend, as of the round before this race)." },

    { key: "gridPosition", category: "qualifying", stage: "post_qualifying", description: "Actual starting grid position (post-penalty)." },
    { key: "qualifyingPosition", category: "qualifying", stage: "post_qualifying", description: "Qualifying classification position." },
    { key: "gapToPoleSeconds", category: "qualifying", stage: "post_qualifying", description: "This driver's best Q1/Q2/Q3 time minus the pole-sitter's best time, in seconds." },
    { key: "teammateQualifyingDelta", category: "qualifying", stage: "post_qualifying", description: "Reused from Phase 2 qualifying.teammateDelta — also satisfies the 'driver vs teammate' qualifying-delta requirement (one column, not two)." },

    { key: "avgFinishLast3", category: "recent_form", stage: "both", description: "Average finishing position over the last 3 races (most-recent-first window)." },
    { key: "avgFinishLast5", category: "recent_form", stage: "both", description: "Average finishing position over the last 5 races." },
    { key: "avgPointsLast3", category: "recent_form", stage: "both", description: "Average points scored over the last 3 races." },
    { key: "avgPointsLast5", category: "recent_form", stage: "both", description: "Average points scored over the last 5 races." },
    { key: "recentFinishingTrend", category: "recent_form", stage: "both", description: "Older-half vs recent-half avg finish within the window; positive = improving (recent finishes are numerically better)." },

    { key: "constructorRecentAvgFinish", category: "constructor", stage: "both", description: "Average finishing position of BOTH team cars over the recent-form window (race performance)." },
    { key: "constructorRecentTrend", category: "constructor", stage: "both", description: "Same older/recent-half comparison as recentFinishingTrend, pooled across both team cars." },
    { key: "constructorQualifyingAvgPosition", category: "constructor", stage: "post_qualifying", description: "Average qualifying position of both team cars at THIS race (qualifying performance)." },

    { key: "teammateRaceDelta", category: "driver_vs_teammate", stage: "both", description: "Reused from Phase 2 driverVsTeammate.avgPositionDelta (positive = ahead of teammate on race pace, recent window)." },
    { key: "teammatePointsDelta", category: "driver_vs_teammate", stage: "both", description: "Average points-per-race delta vs teammate over the recent-form window." },

    { key: "driverDnfRate", category: "reliability", stage: "both", description: "Reused from Phase 2 reliability.dnfRate over the recent-form window." },
    { key: "driverClassifiedFinishRate", category: "reliability", stage: "both", description: "Share of recent starts that were classified (finished or classified-retired) — a distinct lens from dnfRate (status text vs. classification category)." },
    { key: "constructorDnfRate", category: "reliability", stage: "both", description: "DNF rate pooled across both team cars over the recent-form window." },

    { key: "circuitHistoricalScore", category: "circuit", stage: "both", description: "Reused from Phase 2 circuitHistory.score (recency-weighted 0-1 score across all prior editions, 0.5 neutral if never raced here)." },
    { key: "circuitAvgFinish", category: "circuit", stage: "both", description: "Reused from Phase 2 circuitHistory.avgFinish (recency-weighted average finish across all prior editions)." },
    { key: "circuitMostRecentFinish", category: "circuit", stage: "both", description: "This driver's finish at ONLY the single most recent prior edition of this circuit — a distinct data point from the recency-weighted average above." },
    { key: "circuitStartsCount", category: "circuit", stage: "both", description: "Reused from Phase 2 circuitHistory.starts (sample size / experience count)." },

    { key: "hadSprint", category: "sprint", stage: "both", description: "Whether this race weekend has a sprint (0/1) — always a known fact, never missing." },
    { key: "sprintPosition", category: "sprint", stage: "both", description: "Reused from Phase 2 sprint.sprintPosition." },
    { key: "sprintPoints", category: "sprint", stage: "both", description: "Reused from Phase 2 sprint.sprintPoints." },

    { key: "weatherAirTemperature", category: "weather", stage: "both", description: "Historical air temperature (°C) at the race's scheduled start time, from Open-Meteo's archive API (Phase 3.5)." },
    { key: "weatherPrecipitationAmount", category: "weather", stage: "both", description: "Historical measured precipitation (mm) — the archive's actual-amount field, not a forecast probability." },
    { key: "weatherWindSpeed", category: "weather", stage: "both", description: "Historical wind speed (km/h) at race start." },
    { key: "weatherHumidity", category: "weather", stage: "both", description: "Historical relative humidity (%) at race start." },
    { key: "weatherCode", category: "weather", stage: "both", description: "Historical WMO weather code at race start (categorical; kept as its raw numeric code, not one-hot encoded — no training happens in this phase)." },
]);

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

function round(n, dp = 2) {
    if (n === null || n === undefined || Number.isNaN(n)) return null;
    const f = 10 ** dp;
    return Math.round(n * f) / f;
}

function mean(values) {
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

// "1:32.219" -> 92.219 seconds. Jolpica omits a Q-session string entirely
// when a driver didn't set a time in it (eliminated earlier) — that's
// handled by the caller only passing strings that exist.
function parseQualTime(str) {
    if (!str || typeof str !== "string") return null;
    const match = str.match(/^(\d+):(\d{2}(?:\.\d+)?)$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

function bestQualTime(qualResult) {
    if (!qualResult) return null;
    const times = [qualResult.Q1, qualResult.Q2, qualResult.Q3].map(parseQualTime).filter((t) => t !== null);
    return times.length ? Math.min(...times) : null;
}

// ---------------------------------------------------------------------------
// Recent-form window derivations — all read `recentRaces` as already
// fetched by backtestDatasetService (most-recent-first, strictly before
// the target round). No new fetch, no re-scoping.
// ---------------------------------------------------------------------------

function findResult(race, driverId) {
    return race.results.find((r) => r.Driver.driverId === driverId) || null;
}

function avgFinishOverWindow(driverId, recentRaces, n) {
    const window = recentRaces.slice(0, n);
    const finishes = [];
    for (const race of window) {
        const r = findResult(race, driverId);
        const pos = r ? Number(r.position) : NaN;
        if (!Number.isNaN(pos)) finishes.push(pos);
    }
    return finishes.length ? round(mean(finishes)) : null;
}

function avgPointsOverWindow(driverId, recentRaces, n) {
    const window = recentRaces.slice(0, n);
    const points = [];
    for (const race of window) {
        const r = findResult(race, driverId);
        if (!r) continue;
        points.push(Number(r.points) || 0);
    }
    return points.length ? round(mean(points)) : null;
}

// Positive = improving (recent-half average finish is numerically better
// — a lower position number — than the older half of the same window).
function recentFinishingTrend(driverId, recentRaces) {
    const finishes = [];
    for (const race of recentRaces) {
        const r = findResult(race, driverId);
        const pos = r ? Number(r.position) : NaN;
        if (!Number.isNaN(pos)) finishes.push(pos); // preserves most-recent-first order
    }
    if (finishes.length < 2) return null;
    const mid = Math.ceil(finishes.length / 2);
    const recentHalf = finishes.slice(0, mid);
    const olderHalf = finishes.slice(mid);
    if (olderHalf.length === 0) return null;
    return round(mean(olderHalf) - mean(recentHalf));
}

function pointsDeltaVsTeammate(driverId, teammateId, recentRaces) {
    if (!teammateId) return null;
    const deltas = [];
    for (const race of recentRaces) {
        const mine = findResult(race, driverId);
        const theirs = findResult(race, teammateId);
        if (!mine || !theirs) continue;
        deltas.push((Number(mine.points) || 0) - (Number(theirs.points) || 0));
    }
    return deltas.length ? round(mean(deltas)) : null;
}

// ---------------------------------------------------------------------------
// Constructor-level pooling (both team cars) over the same recent-form
// window / this race's own qualifying — reuses teamRoster, already built
// by backtestDatasetService from the ACTUAL race entrants.
// ---------------------------------------------------------------------------

function constructorMates(teamId, teamRoster) {
    return teamRoster.get(teamId) || [];
}

function constructorRecentAvgFinish(teamId, teamRoster, recentRaces, n) {
    const mates = constructorMates(teamId, teamRoster);
    const window = recentRaces.slice(0, n);
    const finishes = [];
    for (const race of window) {
        for (const mate of mates) {
            const r = findResult(race, mate);
            const pos = r ? Number(r.position) : NaN;
            if (!Number.isNaN(pos)) finishes.push(pos);
        }
    }
    return finishes.length ? round(mean(finishes)) : null;
}

function constructorRecentTrend(teamId, teamRoster, recentRaces) {
    const mates = constructorMates(teamId, teamRoster);
    // One pooled finish list per race (both cars), most-recent-first,
    // mirroring recentFinishingTrend's own older/recent-half comparison.
    const perRaceAvg = [];
    for (const race of recentRaces) {
        const finishes = mates
            .map((mate) => findResult(race, mate))
            .filter(Boolean)
            .map((r) => Number(r.position))
            .filter((p) => !Number.isNaN(p));
        if (finishes.length) perRaceAvg.push(mean(finishes));
    }
    if (perRaceAvg.length < 2) return null;
    const mid = Math.ceil(perRaceAvg.length / 2);
    const recentHalf = perRaceAvg.slice(0, mid);
    const olderHalf = perRaceAvg.slice(mid);
    if (olderHalf.length === 0) return null;
    return round(mean(olderHalf) - mean(recentHalf));
}

function constructorQualifyingAvgPosition(teamId, teamRoster, qualifyingResults) {
    const mates = constructorMates(teamId, teamRoster);
    const positions = mates
        .map((mate) => qualifyingResults.find((q) => q.Driver.driverId === mate))
        .filter(Boolean)
        .map((q) => Number(q.position))
        .filter((p) => !Number.isNaN(p));
    return positions.length ? round(mean(positions)) : null;
}

// Pooled DNF rate across both team cars over the recent-form window. Same
// "Finished or +N Lap(s) = ran to the end" rule backtestDatasetService's
// own per-driver computeReliabilityFeature uses; that function is
// per-driver only, so this is the constructor-level equivalent — Phase 2
// itself is left unmodified (see this file's header).
function constructorDnfRate(teamId, teamRoster, recentRaces) {
    const mates = constructorMates(teamId, teamRoster);
    let starts = 0;
    let dnfs = 0;
    for (const race of recentRaces) {
        for (const mate of mates) {
            const r = findResult(race, mate);
            if (!r) continue;
            starts += 1;
            const status = r.status || "";
            const finished = status === "Finished" || status.startsWith("+");
            if (!finished) dnfs += 1;
        }
    }
    return starts ? round(dnfs / starts, 3) : null;
}

// classified/classified_retired share of recent starts — distinct from
// dnfRate (status-text based): a car that's running at the end but not
// formally classified (didn't cover enough distance) would count
// differently under each lens.
function classifiedFinishRate(driverId, recentRaces, resolveActualPosition) {
    let starts = 0;
    let classified = 0;
    for (const race of recentRaces) {
        const r = findResult(race, driverId);
        if (!r) continue;
        starts += 1;
        const { status } = resolveActualPosition(r);
        if (status === "classified" || status === "classified_retired") classified += 1;
    }
    return starts ? round(classified / starts, 3) : null;
}

// Walks circuitRaces (oldest-first, per backtestDatasetService's own
// fetchCircuitHistory contract) backward to this driver's single most
// recent prior start here — a different signal from the recency-WEIGHTED
// AVERAGE Phase 2's circuitHistory.avgFinish already provides.
function mostRecentCircuitFinish(driverId, circuitRaces) {
    for (let i = circuitRaces.length - 1; i >= 0; i--) {
        const r = circuitRaces[i].Results?.find((x) => x.Driver.driverId === driverId);
        if (r) {
            const pos = Number(r.position);
            return Number.isNaN(pos) ? null : pos;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Main entry point — called once per driver per stage from
// backtestDatasetService.generateRaceSamples, with everything it needs
// already fetched/computed and passed in.
// ---------------------------------------------------------------------------

function buildMLFeatureVector({
    stage,
    driverId,
    teammateId,
    teamId,
    result,
    recentRaces,
    circuitRaces,
    qualifyingResults,
    sprintResults,
    teamRoster,
    resolveActualPosition,
    phase2, // { championshipStanding, constructorStrength, recentForm, circuitHistory, driverVsTeammate, reliability, sprint, qualifying, weather }
}) {
    // Independent enforcement of "PRE_QUALIFYING must never contain
    // qualifying-derived features" for the NEW qualifying-shaped numbers
    // this file computes (gap to pole, constructor qualifying average) —
    // Phase 2's own gate only covers `features.qualifying`, not these.
    const { qualifyingResults: gatedQualifying } = sanitizeStageInputs(stage, { qualifyingResults, sprintResults });
    const isPostQualifying = stage === STAGES.POST_QUALIFYING;

    const qualResult = isPostQualifying ? gatedQualifying.find((q) => q.Driver.driverId === driverId) : null;
    const poleResult = isPostQualifying ? gatedQualifying.find((q) => q.position === "1") : null;
    const myBestTime = bestQualTime(qualResult);
    const poleBestTime = bestQualTime(poleResult);
    const gridPosition = isPostQualifying ? Number(result.grid) : null;

    const sprint = phase2.sprint;

    const mlFeatures = {
        championshipStandingScore: phase2.championshipStanding.available ? round(phase2.championshipStanding.score, 4) : null,

        gridPosition: isPostQualifying && !Number.isNaN(gridPosition) ? gridPosition : null,
        qualifyingPosition: isPostQualifying && qualResult ? Number(qualResult.position) : null,
        gapToPoleSeconds: isPostQualifying && myBestTime !== null && poleBestTime !== null ? round(myBestTime - poleBestTime, 3) : null,
        teammateQualifyingDelta: isPostQualifying && phase2.qualifying.available ? phase2.qualifying.teammateDelta : null,

        avgFinishLast3: avgFinishOverWindow(driverId, recentRaces, 3),
        avgFinishLast5: avgFinishOverWindow(driverId, recentRaces, 5),
        avgPointsLast3: avgPointsOverWindow(driverId, recentRaces, 3),
        avgPointsLast5: avgPointsOverWindow(driverId, recentRaces, 5),
        recentFinishingTrend: recentFinishingTrend(driverId, recentRaces),

        constructorRecentAvgFinish: constructorRecentAvgFinish(teamId, teamRoster, recentRaces, 5),
        constructorRecentTrend: constructorRecentTrend(teamId, teamRoster, recentRaces),
        constructorQualifyingAvgPosition: isPostQualifying ? constructorQualifyingAvgPosition(teamId, teamRoster, gatedQualifying) : null,

        teammateRaceDelta: phase2.driverVsTeammate.available ? phase2.driverVsTeammate.avgPositionDelta : null,
        teammatePointsDelta: pointsDeltaVsTeammate(driverId, teammateId, recentRaces),

        driverDnfRate: phase2.reliability.available ? phase2.reliability.dnfRate : null,
        driverClassifiedFinishRate: classifiedFinishRate(driverId, recentRaces, resolveActualPosition),
        constructorDnfRate: constructorDnfRate(teamId, teamRoster, recentRaces),

        circuitHistoricalScore: phase2.circuitHistory.available ? round(phase2.circuitHistory.score, 4) : null,
        circuitAvgFinish: phase2.circuitHistory.avgFinish !== null ? round(phase2.circuitHistory.avgFinish) : null,
        circuitMostRecentFinish: mostRecentCircuitFinish(driverId, circuitRaces),
        circuitStartsCount: phase2.circuitHistory.starts,

        hadSprint: sprint.hadSprint ? 1 : 0,
        sprintPosition: sprint.available ? sprint.sprintPosition : null,
        sprintPoints: sprint.available ? sprint.sprintPoints : null,

        weatherAirTemperature: phase2.weather?.available ? phase2.weather.airTemperature : null,
        weatherPrecipitationAmount: phase2.weather?.available ? phase2.weather.precipitationAmount : null,
        weatherWindSpeed: phase2.weather?.available ? phase2.weather.windSpeed : null,
        weatherHumidity: phase2.weather?.available ? phase2.weather.humidity : null,
        weatherCode: phase2.weather?.available ? phase2.weather.weatherCode : null,
    };

    const mlFeatureAvailability = {};
    for (const key of Object.keys(mlFeatures)) {
        mlFeatureAvailability[key] = key === "hadSprint" ? true : mlFeatures[key] !== null;
    }

    return { mlFeatures, mlFeatureAvailability };
}

module.exports = { buildMLFeatureVector, FEATURE_CATALOG };
