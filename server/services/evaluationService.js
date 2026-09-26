/*
 * ═══════════════════════════════════════════════════════════════════
 * PREDICTION VS REALITY — MODEL EVALUATION (Phase 14)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Compares a STORED prediction (server/models/RacePrediction.js — saved
 * by predictorService.js at the moment it was generated, "live" for the
 * genuine upcoming-race case or "backtest" for a leakage-safe historical
 * reconstruction) against the actual Jolpica race result. This file never
 * generates or alters a prediction — it only reads one back and measures
 * it. See predictorService.js's module header for how leakage is
 * prevented at generation time; this file's job is measurement only.
 *
 * ELIGIBILITY (Part 20)
 * A race is only evaluated if: a stored prediction exists for it, AND
 * Jolpica actually has a completed result for it. Anything else is
 * reported as ineligible with a reason, never silently skipped or faked.
 *
 * DNF / DNS / DSQ HANDLING (Part 21)
 * Jolpica assigns every driver who was actually running at the end a
 * real classified `position` (even a retiree who covered enough race
 * distance — this matches how F1 itself scores a late retirement), while
 * `positionText` carries the letter code for anything unusual:
 *   "R" (Retired)   — STILL scored using the real classified `position`;
 *                      this is standard motorsport statistics practice,
 *                      not a special case.
 *   "D" (Disqualified), "W" (Withdrawn/DNS), "N" (Not classified),
 *   or simply absent from the results entirely — EXCLUDED from
 *   position-error/hit-rate math (there's no meaningful "effective
 *   finish" for these), but still shown per-driver with their status so
 *   nothing is silently dropped.
 *
 * CACHING
 * Once a race's actual result exists, it never changes — evaluations are
 * cached in memory indefinitely per (season, round) rather than
 * recomputed on every request. Only the small set of recently-completed
 * rounds get lazily backtested/persisted on first request (see
 * ensureBacktestSeeded), never on every page load.
 */

const { getJson, getJsonRetry } = require("./jolpicaClient");
const { cached, TTL } = require("./jolpicaCache");
const RacePrediction = require("../models/RacePrediction");
const { buildBacktestPrediction } = require("./predictorService");

const BACKTEST_LOOKBACK = 3; // how many recent completed rounds to auto-seed if missing

const evaluationCache = new Map(); // "season-round" -> evaluation result

// ---------------------------------------------------------------------------
// Actual results
// ---------------------------------------------------------------------------

// Distinguishes "Jolpica answered cleanly, race just hasn't happened yet"
// (an empty Races array, HTTP 200) from "the request itself failed"
// (network error, rate limit, etc.) — these must not be reported as the
// same eligibility reason, or a transient API hiccup would wrongly look
// identical to a genuinely future race.
async function fetchActualResults(season, round) {
    try {
        // Short TTL (not HISTORICAL) — this is called for rounds that may
        // not have completed yet; caching an empty "not run yet" answer
        // for too long would delay evaluateRace() from ever noticing the
        // race actually finished. Once a race IS evaluated, evaluateRace's
        // own outer cache means this never gets called for it again, so
        // the short TTL only ever matters for the still-pending case.
        const data = await cached(`predictor:actual-results:${season}:${round}`, TTL.LATEST, () => getJson(`/${season}/${round}/results.json`));
        return { results: data.MRData.RaceTable.Races[0]?.Results || [], failed: false };
    } catch {
        return { results: [], failed: true };
    }
}

function resolveActualPosition(result) {
    if (!result) return { position: null, status: "no_result" };
    const text = result.positionText;
    if (/^\d+$/.test(text)) return { position: Number(result.position), status: "classified" };
    if (text === "R") return { position: Number(result.position), status: "classified_retired" };
    if (text === "D") return { position: null, status: "dsq" };
    if (text === "W") return { position: null, status: "dns" };
    return { position: null, status: "unclassified" };
}

// A position counts toward position-error / hit-rate math only when the
// driver has a real, meaningful effective finish (see module header).
function isScorable(status) {
    return status === "classified" || status === "classified_retired";
}

// ---------------------------------------------------------------------------
// Stored predictions
// ---------------------------------------------------------------------------

async function getStoredPrediction(season, round) {
    const docs = await RacePrediction.find({ season: String(season), round: Number(round) }).lean();
    if (docs.length === 0) return null;
    return docs.find((d) => d.stage === "post_qualifying") || docs[0];
}

// ---------------------------------------------------------------------------
// Matching + metrics
// ---------------------------------------------------------------------------

function matchAndEvaluate(storedPrediction, actualResults) {
    const actualByDriver = new Map(actualResults.map((r) => [r.Driver.driverId, r]));

    const driverEvaluations = storedPrediction.predictions.map((p) => {
        const { position: actualPosition, status } = resolveActualPosition(actualByDriver.get(p.driverId));
        const scorable = isScorable(status);
        const positionError = scorable ? Math.abs(p.predictedPosition - actualPosition) : null;
        return {
            driverId: p.driverId,
            driverName: p.driverName,
            driverCode: p.driverCode,
            constructor: p.constructor,
            predictedPosition: p.predictedPosition,
            actualPosition,
            status,
            positionError,
            winProbability: p.winProbability,
            podiumProbability: p.podiumProbability,
        };
    });

    const scorable = driverEvaluations.filter((d) => d.positionError !== null);
    const meanPositionError = scorable.length
        ? Number((scorable.reduce((sum, d) => sum + d.positionError, 0) / scorable.length).toFixed(2))
        : null;

    const predictedWinner = driverEvaluations.find((d) => d.predictedPosition === 1) || null;
    const winnerCorrect = Boolean(predictedWinner && predictedWinner.status === "classified" && predictedWinner.actualPosition === 1);

    const actualClassifiedSorted = driverEvaluations
        .filter((d) => isScorable(d.status))
        .slice()
        .sort((a, b) => a.actualPosition - b.actualPosition);

    function hitRate(n) {
        const predictedSet = new Set(driverEvaluations.filter((d) => d.predictedPosition <= n).map((d) => d.driverId));
        const actualTopN = actualClassifiedSorted.slice(0, n).map((d) => d.driverId);
        if (actualTopN.length === 0) return null;
        const hits = actualTopN.filter((id) => predictedSet.has(id)).length;
        return Number((hits / actualTopN.length).toFixed(3));
    }

    return {
        driverEvaluations,
        metrics: {
            winnerCorrect,
            podiumHitRate: hitRate(3),
            top5HitRate: hitRate(5),
            top10HitRate: hitRate(10),
            meanPositionError,
            scorableDrivers: scorable.length,
            totalDrivers: driverEvaluations.length,
        },
    };
}

// ---------------------------------------------------------------------------
// Per-race evaluation (cached)
// ---------------------------------------------------------------------------

async function evaluateRace(season, round) {
    const cacheKey = `${season}-${round}`;
    if (evaluationCache.has(cacheKey)) return evaluationCache.get(cacheKey);

    const storedPrediction = await getStoredPrediction(season, round);
    if (!storedPrediction) {
        return { eligible: false, reason: "no_prediction", season, round };
    }

    const { results: actualResults, failed } = await fetchActualResults(season, round);
    if (failed) {
        // Transient — deliberately NOT cached, so a retry can succeed once
        // the upstream issue clears.
        return { eligible: false, reason: "result_fetch_failed", season, round };
    }
    if (actualResults.length === 0) {
        return { eligible: false, reason: "race_not_completed", season, round };
    }

    const actualWinnerResult = actualResults.find((r) => r.positionText === "1");
    const { driverEvaluations, metrics } = matchAndEvaluate(storedPrediction, actualResults);

    const result = {
        eligible: true,
        season,
        round,
        raceName: storedPrediction.raceName,
        circuit: storedPrediction.circuit,
        raceDate: storedPrediction.raceDate,
        predictionSource: storedPrediction.source,
        predictionStage: storedPrediction.stage,
        predictionGeneratedAt: storedPrediction.generatedAt,
        predictedWinner: driverEvaluations.find((d) => d.predictedPosition === 1)?.driverName ?? null,
        actualWinner: actualWinnerResult ? `${actualWinnerResult.Driver.givenName} ${actualWinnerResult.Driver.familyName}` : null,
        driverEvaluations,
        metrics,
    };

    evaluationCache.set(cacheKey, result);
    return result;
}

// ---------------------------------------------------------------------------
// Lazy backtest seeding — only for a small recent window, only if missing
// ---------------------------------------------------------------------------

async function ensureBacktestSeeded(season, currentRound) {
    const candidateRounds = [];
    for (let r = currentRound - 1; r >= Math.max(1, currentRound - BACKTEST_LOOKBACK); r--) candidateRounds.push(r);
    if (candidateRounds.length === 0) return;

    const existing = await RacePrediction.find({ season: String(season), round: { $in: candidateRounds } }).distinct("round");
    const existingSet = new Set(existing.map(Number));
    const missing = candidateRounds.filter((r) => !existingSet.has(r));

    for (const round of missing) {
        try {
            await buildBacktestPrediction(season, round);
        } catch (error) {
            console.error(`[Evaluation] Backtest seed failed for round ${round}: ${error.message}`);
        }
    }
}

// ---------------------------------------------------------------------------
// History + aggregate performance
// ---------------------------------------------------------------------------

// Same endpoint, same cache key as predictorService.js's fetchUpcomingRace
// — /history and /performance requesting "the current race" on the same
// page load as /upcoming now share one cached response instead of each
// firing their own request.
async function fetchCurrentSeasonAndRound() {
    const data = await cached("predictor:next-race", TTL.SCHEDULE, () => getJsonRetry("/current/next.json"));
    const race = data.MRData.RaceTable.Races[0];
    if (!race) return null;
    return { season: race.season, round: Number(race.round) };
}

async function getPredictionHistory() {
    const upcoming = await fetchCurrentSeasonAndRound();
    if (!upcoming) return { races: [] };

    await ensureBacktestSeeded(upcoming.season, upcoming.round);

    const rounds = await RacePrediction.find({ season: upcoming.season, round: { $lt: upcoming.round } }).distinct("round");
    const sorted = rounds.map(Number).sort((a, b) => a - b);

    const evaluations = await Promise.all(sorted.map((round) => evaluateRace(upcoming.season, round)));
    return { races: evaluations };
}

async function getRaceEvaluation(season, round) {
    return evaluateRace(season, Number(round));
}

async function getPerformanceSummary() {
    const { races } = await getPredictionHistory();
    const eligible = races.filter((r) => r.eligible);

    if (eligible.length === 0) {
        return { racesEvaluated: 0, available: false };
    }

    const winnerCorrectCount = eligible.filter((r) => r.metrics.winnerCorrect).length;
    const avg = (key) => {
        const values = eligible.map((r) => r.metrics[key]).filter((v) => v !== null && v !== undefined);
        return values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(3)) : null;
    };

    // Driver-level aggregation across all evaluated races.
    const byDriver = new Map();
    for (const race of eligible) {
        for (const d of race.driverEvaluations) {
            if (d.positionError === null) continue;
            if (!byDriver.has(d.driverId)) {
                byDriver.set(d.driverId, { driverId: d.driverId, driverName: d.driverName, driverCode: d.driverCode, errors: [], predicted: [], actual: [] });
            }
            const entry = byDriver.get(d.driverId);
            entry.errors.push(d.positionError);
            entry.predicted.push(d.predictedPosition);
            entry.actual.push(d.actualPosition);
        }
    }

    const driverPerformance = Array.from(byDriver.values()).map((d) => ({
        driverId: d.driverId,
        driverName: d.driverName,
        driverCode: d.driverCode,
        predictionsEvaluated: d.errors.length,
        avgPredictedPosition: Number((d.predicted.reduce((a, b) => a + b, 0) / d.predicted.length).toFixed(2)),
        avgActualPosition: Number((d.actual.reduce((a, b) => a + b, 0) / d.actual.length).toFixed(2)),
        avgPositionError: Number((d.errors.reduce((a, b) => a + b, 0) / d.errors.length).toFixed(2)),
        bestPredictionError: Math.min(...d.errors),
        worstPredictionError: Math.max(...d.errors),
    }));

    return {
        available: true,
        racesEvaluated: eligible.length,
        winnerAccuracy: Number((winnerCorrectCount / eligible.length).toFixed(3)),
        avgPodiumHitRate: avg("podiumHitRate"),
        avgTop5HitRate: avg("top5HitRate"),
        avgTop10HitRate: avg("top10HitRate"),
        meanPositionError: avg("meanPositionError"),
        driverPerformance: driverPerformance.sort((a, b) => a.avgPositionError - b.avgPositionError),
    };
}

module.exports = { getPredictionHistory, getRaceEvaluation, getPerformanceSummary };
