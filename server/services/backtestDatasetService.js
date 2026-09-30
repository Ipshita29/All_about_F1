/*
 * ═══════════════════════════════════════════════════════════════════
 * BACKTESTING DATASET GENERATOR (Phase 2 of the accuracy-improvement plan)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Builds a leakage-safe, driver-level historical dataset — one record per
 * driver per completed race per requested stage — for later ML training/
 * evaluation. This file GENERATES data only. It does not train anything,
 * does not touch predictorService.js's live scoring path (buildPrediction/
 * assemblePrediction/combineFeatures/simulateRace are never called here),
 * and does not change the UI. See predictionDataPolicy.js (Phase 1) for
 * the allowed-data spec this file is built on top of.
 *
 * Since Phase 3, each sample also carries `mlFeatures`/
 * `mlFeatureAvailability` — the flat numeric ML feature vector built by
 * featureEngineeringService.js from the exact raw arrays and Phase 2
 * feature objects already assembled below. `outcome` and `features`
 * (this file's own Phase 2 shape) are unchanged; Phase 3 only adds keys,
 * never alters or removes what was here before.
 *
 * REUSE, NOT REIMPLEMENTATION
 * Every feature that predictorService.js already computes (championship
 * standing, constructor strength, recent form, circuit history,
 * qualifying) is called here via predictorService.js's own exported
 * functions — the exact same math, same leakage reasoning, same code.
 * This file only adds THREE genuinely new, dataset-only computations for
 * categories Phase 1 marked "available" but not yet scored anywhere
 * (driver-vs-teammate, reliability/DNF, sprint), built from data that's
 * already being fetched for recentForm — no extra Jolpica calls for them.
 * Weather has no historical source (see computeWeatherFeature) and is
 * honestly recorded as unavailable rather than faked.
 *
 * ONE RECORD, TWO PARTS
 *   outcome  — historical facts about this driver's actual race weekend
 *              (grid position, qualifying position, finishing position,
 *              points, status). These are the dataset's LABELS, not
 *              inputs — a training pipeline reads finishPosition as
 *              "what actually happened", never as a feature. Always
 *              fully populated, because the race already happened.
 *   features — the INPUTS a model would have had at that prediction
 *              point. Gated by stage via predictionDataPolicy's own
 *              sanitizeStageInputs(): for a PRE_QUALIFYING sample,
 *              features.qualifying is always unavailable, even though
 *              outcome.qualifyingPosition is filled in above it. That
 *              split — real qualifying position recorded as history,
 *              but never exposed as a PRE_QUALIFYING input — is exactly
 *              what "qualifying data only in the POST_QUALIFYING
 *              dataset/stage" (Phase 2 requirement 3) means in practice.
 *
 * LEAKAGE PREVENTION (see logSummary's printed guarantee at the end of
 * every run)
 *   - championshipStanding/constructorStrength: standings AS OF THE
 *     ROUND BEFORE the one being labeled (fetchStandingsAsOf), never the
 *     final/current standings.
 *   - recentForm/driverVsTeammate/reliability: built from
 *     predictorService.fetchRecentResults, which only ever returns
 *     rounds strictly before the target round — enforced there, reused
 *     here unchanged.
 *   - circuitHistory: a different race entirely by construction.
 *   - qualifying: that race's own real qualifying result, which
 *     genuinely happened before the race — allowed at POST_QUALIFYING
 *     only, gated through predictionDataPolicy.sanitizeStageInputs.
 *   - The race's own finishing result is fetched exactly once, and only
 *     ever written into `outcome` — no compute*Feature function in this
 *     file or predictorService.js is ever called with it.
 */

const { getJsonRetry } = require("./jolpicaClient");
const { cached, TTL } = require("./jolpicaCache");
const { STAGES, sanitizeStageInputs } = require("./predictionDataPolicy");
const { resolveActualPosition } = require("./evaluationService");
const { buildMLFeatureVector } = require("./featureEngineeringService");
const {
    RECENT_FORM_RACE_COUNT,
    fetchRecentResults,
    fetchQualifying,
    fetchSprintResults,
    fetchCircuitHistory,
    computeChampionshipFeature,
    computeConstructorFeature,
    computeRecentFormFeature,
    computeCircuitHistoryFeature,
    computeQualifyingFeature,
} = require("./predictorService");

// ---------------------------------------------------------------------------
// Data access — thin wrappers around the shared Jolpica client/cache, same
// pattern predictorService.js and evaluationService.js each already use.
// No new API client; cache keys deliberately match the existing callers
// that fetch the identical data, so this shares cache entries with them
// instead of doubling Jolpica traffic.
// ---------------------------------------------------------------------------

// Bulk historical generation fires far more Jolpica requests in quick
// succession than a single page load ever does (predictorService.js's own
// docs put a single live prediction at ~10-15 calls; this can walk 20+
// races back to back). A cold cache burst that size reliably trips the
// documented 3 req/s free tier, so these calls get a longer, more patient
// retry than jolpicaClient's own default (2 attempts / 400ms) — scoped to
// this file only, never changed in jolpicaClient.js itself, so the live
// predictor's and evaluator's own retry behavior is untouched.
const DATASET_RETRY_ATTEMPTS = 4;
const DATASET_RETRY_DELAY_MS = 1200;

function getJsonPatient(path) {
    return getJsonRetry(path, DATASET_RETRY_ATTEMPTS, DATASET_RETRY_DELAY_MS);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSeasonSchedule(season) {
    // Same cache key grandprixController.js's own schedule fetch uses.
    const data = await cached(`schedule:${season}`, TTL.SCHEDULE, () => getJsonPatient(`/${season}.json?limit=100`));
    return data.MRData.RaceTable.Races || [];
}

// Race identity (name, circuit, whether this round has a sprint) — same
// cache key predictorService.buildBacktestPrediction already uses for
// this exact call.
async function fetchRaceIdentity(season, round) {
    const data = await cached(`predictor:race:${season}:${round}`, TTL.HISTORICAL, () => getJsonPatient(`/${season}/${round}.json`));
    return data.MRData.RaceTable.Races[0] || null;
}

// The actual result of the race being labeled — used ONLY to build
// `outcome` below, never passed into any compute*Feature call. Same cache
// key predictorService.fetchRecentResults uses when this round is a LATER
// race's "recent form" input, so the two share one cache entry.
async function fetchActualRaceResult(season, round) {
    try {
        const data = await cached(`results:${season}:${round}`, TTL.HISTORICAL, () => getJsonPatient(`/${season}/${round}/results.json`));
        return { results: data.MRData.RaceTable.Races[0]?.Results || [], failed: false };
    } catch {
        return { results: [], failed: true };
    }
}

// Standings AS OF the round before the one being labeled — the same
// leakage-safe pattern and cache keys predictorService.buildBacktestPrediction
// already uses inline; written fresh here rather than exported from
// predictorService, since that file's body is left untouched (Phase 2
// requirement 7).
async function fetchStandingsAsOf(season, asOfRound) {
    const [driverData, constructorData] = await Promise.all([
        cached(`predictor:standings-asof:${season}:${asOfRound}:driver`, TTL.HISTORICAL, () => getJsonPatient(`/${season}/${asOfRound}/driverstandings.json?limit=100`)).catch(() => null),
        cached(`predictor:standings-asof:${season}:${asOfRound}:constructor`, TTL.HISTORICAL, () => getJsonPatient(`/${season}/${asOfRound}/constructorstandings.json?limit=100`)).catch(() => null),
    ]);
    return {
        driverStandings: driverData?.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [],
        constructorStandings: constructorData?.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [],
    };
}

// ---------------------------------------------------------------------------
// New, dataset-only feature computations (Phase 1 marked these "available,
// not yet scored" — this is that data collection, not a change to what the
// live predictor scores). Built entirely from `recentRaces`, which is
// already fetched for computeRecentFormFeature — no extra Jolpica calls.
// ---------------------------------------------------------------------------

// Average finishing-position delta vs. this driver's actual teammate over
// the same recent-form window (positive = this driver finished ahead more
// often). Mirrors predictorService's existing teammate-delta reasoning for
// qualifying, applied to race pace instead.
function computeDriverVsTeammateFeature(driverId, teammateId, recentRaces) {
    if (!teammateId) return { available: false, avgPositionDelta: null, racesCompared: 0 };

    let deltaSum = 0;
    let count = 0;
    for (const race of recentRaces) {
        const mine = race.results.find((r) => r.Driver.driverId === driverId);
        const theirs = race.results.find((r) => r.Driver.driverId === teammateId);
        if (!mine || !theirs) continue;
        const myPos = Number(mine.position);
        const theirPos = Number(theirs.position);
        if (Number.isNaN(myPos) || Number.isNaN(theirPos)) continue;
        deltaSum += theirPos - myPos; // positive = finished ahead of teammate
        count += 1;
    }

    if (count === 0) return { available: false, avgPositionDelta: null, racesCompared: 0 };
    return { available: true, avgPositionDelta: Number((deltaSum / count).toFixed(2)), racesCompared: count };
}

// DNF rate over the same recent-form window. Uses Jolpica's free-text
// `status` field ("Finished" / "+N Lap(s)" = ran to the end; anything
// else — Retired, Accident, Engine, Collision, … — counts as a DNF for
// reliability purposes), which is a finer-grained signal than the
// classified/retired distinction evaluationService uses for scoring.
function computeReliabilityFeature(driverId, recentRaces) {
    let starts = 0;
    let dnfs = 0;
    for (const race of recentRaces) {
        const result = race.results.find((r) => r.Driver.driverId === driverId);
        if (!result) continue;
        starts += 1;
        const status = result.status || "";
        const finished = status === "Finished" || status.startsWith("+");
        if (!finished) dnfs += 1;
    }

    if (starts === 0) return { available: false, dnfRate: null, startsConsidered: 0 };
    return { available: true, dnfRate: Number((dnfs / starts).toFixed(3)), startsConsidered: starts };
}

// This weekend's sprint result, if the round has one and it has already
// run — reuses fetchSprintResults, same rule predictorService's own
// recentForm folding already relies on ("empty on a sprint weekend means
// hasn't run yet", enforced by the caller only fetching when race.Sprint
// is present, same as here).
function computeSprintFeature(driverId, sprintResults) {
    if (!sprintResults || sprintResults.length === 0) {
        return { available: false, hadSprint: false, sprintPosition: null, sprintPoints: null };
    }
    const result = sprintResults.find((r) => r.Driver.driverId === driverId);
    if (!result) return { available: false, hadSprint: true, sprintPosition: null, sprintPoints: null };
    const position = Number(result.position);
    return {
        available: true,
        hadSprint: true,
        sprintPosition: Number.isNaN(position) ? null : position,
        sprintPoints: Number(result.points) || 0,
    };
}

// weatherService.js (see its own header) only ever calls Open-Meteo's
// forecast endpoint, which covers ~16 days ahead — it has no historical
// archive. Calling it for a past race would either error or silently
// return today's forecast mislabeled as that race's weather, which is
// worse than admitting the data doesn't exist. Every dataset row is
// honest about this instead.
function computeWeatherFeature() {
    return {
        available: false,
        reason: "no historical weather archive integrated — weatherService.js only provides live/near-term forecasts",
    };
}

// ---------------------------------------------------------------------------
// Per-race, per-driver sample assembly
// ---------------------------------------------------------------------------

async function generateRaceSamples(season, round, { stages = [STAGES.PRE_QUALIFYING, STAGES.POST_QUALIFYING] } = {}) {
    const asOfRound = round - 1;
    if (asOfRound < 1) {
        return { skipped: true, reason: "no_prior_standings", season, round, samples: [] };
    }

    const race = await fetchRaceIdentity(season, round);
    if (!race) return { skipped: true, reason: "race_not_found", season, round, samples: [] };

    const { results: actualResults, failed } = await fetchActualRaceResult(season, round);
    if (failed) return { skipped: true, reason: "result_fetch_failed", season, round, samples: [] };
    if (actualResults.length === 0) return { skipped: true, reason: "race_not_completed", season, round, samples: [] };

    const { driverStandings, constructorStandings } = await fetchStandingsAsOf(season, asOfRound);
    if (driverStandings.length === 0) return { skipped: true, reason: "insufficient_historical_standings", season, round, samples: [] };

    const circuitId = race.Circuit?.circuitId ?? null;
    const [recentRaces, circuitRaces, qualifyingResults, sprintResults] = await Promise.all([
        fetchRecentResults(season, round, RECENT_FORM_RACE_COUNT),
        fetchCircuitHistory(circuitId),
        fetchQualifying(season, round), // that race's OWN real qualifying — genuinely pre-race, gated below by stage
        race.Sprint ? fetchSprintResults(season, round) : Promise.resolve([]),
    ]);

    const fieldSize = driverStandings.length;
    const constructorFieldSize = constructorStandings.length;
    const driverStandingByDriver = new Map(driverStandings.map((s) => [s.Driver.driverId, s]));
    const constructorStandingByTeam = new Map(constructorStandings.map((c) => [c.Constructor.constructorId, c]));
    const leaderPoints = Number(driverStandings[0]?.points) || 0;
    const constructorLeaderPoints = Number(constructorStandings[0]?.points) || 0;

    // Teammate pairings from the ACTUAL race entrants, not the as-of
    // standings snapshot — correct even across a mid-season driver swap.
    const teamRoster = new Map();
    for (const r of actualResults) {
        const teamId = r.Constructor?.constructorId;
        if (!teamId) continue;
        if (!teamRoster.has(teamId)) teamRoster.set(teamId, []);
        teamRoster.get(teamId).push(r.Driver.driverId);
    }

    const missing = { standings: 0, teammate: 0, recentForm: 0, circuitHistory: 0, qualifying: 0, sprint: 0 };
    const samples = [];

    for (const result of actualResults) {
        const driverId = result.Driver.driverId;
        const teamId = result.Constructor?.constructorId ?? null;
        const teammateId = (teamRoster.get(teamId) || []).find((id) => id !== driverId) || null;
        if (!teammateId) missing.teammate += 1;

        const standing = driverStandingByDriver.get(driverId);
        if (!standing) missing.standings += 1;
        const constructorStanding = constructorStandingByTeam.get(teamId);

        const championshipStanding = computeChampionshipFeature(standing, fieldSize, leaderPoints);
        const constructorStrength = computeConstructorFeature(constructorStanding, constructorFieldSize, constructorLeaderPoints);

        const recentForm = computeRecentFormFeature(driverId, recentRaces);
        if (!recentForm.available) missing.recentForm += 1;
        const circuitHistory = computeCircuitHistoryFeature(driverId, circuitRaces);
        if (!circuitHistory.available) missing.circuitHistory += 1;
        const driverVsTeammate = computeDriverVsTeammateFeature(driverId, teammateId, recentRaces);
        const reliability = computeReliabilityFeature(driverId, recentRaces);
        const sprint = computeSprintFeature(driverId, sprintResults);
        if (race.Sprint && !sprint.available) missing.sprint += 1;
        const weather = computeWeatherFeature();

        const { position: finishPosition, status: classification } = resolveActualPosition(result);
        const gridPosition = Number(result.grid);
        const qualResult = qualifyingResults.find((q) => q.Driver.driverId === driverId);
        if (!qualResult) missing.qualifying += 1;
        const qualifyingPositionRaw = qualResult ? Number(qualResult.position) : null;

        const outcome = {
            gridPosition: Number.isNaN(gridPosition) ? null : gridPosition,
            qualifyingPosition: qualifyingPositionRaw,
            finishPosition,
            points: Number(result.points) || 0,
            status: result.status || null,
            classification,
        };

        for (const stage of stages) {
            // The one enforced gate (Phase 1) — for PRE_QUALIFYING this
            // always yields an empty qualifyingResults array regardless of
            // what was fetched above, so features.qualifying below is
            // always { available: false } for that stage.
            const { qualifyingResults: gatedQualifying } = sanitizeStageInputs(stage, { qualifyingResults, sprintResults });
            const qualifying = computeQualifyingFeature(driverId, gatedQualifying, teammateId);

            // Phase 3 — the flat, numeric ML feature vector, built from the
            // same raw arrays and Phase 2 feature objects already in scope
            // here. See featureEngineeringService.js for what each key
            // means and how the qualifying gate is independently enforced
            // for the new qualifying-derived numbers Phase 2 never computed
            // (gap to pole, constructor qualifying average).
            const { mlFeatures, mlFeatureAvailability } = buildMLFeatureVector({
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
                phase2: { championshipStanding, constructorStrength, recentForm, circuitHistory, driverVsTeammate, reliability, sprint, qualifying },
            });

            samples.push({
                season: String(season),
                round,
                race: race.raceName,
                circuitId,
                driverId,
                driverName: `${result.Driver.givenName} ${result.Driver.familyName}`,
                constructorId: teamId,
                constructorName: result.Constructor?.name ?? null,
                stage,
                outcome,
                features: {
                    championshipStanding,
                    constructorStrength,
                    recentForm,
                    circuitHistory,
                    driverVsTeammate,
                    reliability,
                    sprint,
                    weather,
                    qualifying,
                },
                mlFeatures,
                mlFeatureAvailability,
            });
        }
    }

    return { skipped: false, season, round, raceName: race.raceName, driverCount: actualResults.length, samples, missing };
}

// ---------------------------------------------------------------------------
// Season / multi-season orchestration + validation summary
// ---------------------------------------------------------------------------

function emptyMissingTotals() {
    return { standings: 0, teammate: 0, recentForm: 0, circuitHistory: 0, qualifying: 0, sprint: 0 };
}

async function generateSeasonDataset(season, { stages, fromRound, toRound } = {}) {
    const usedStages = stages || [STAGES.PRE_QUALIFYING, STAGES.POST_QUALIFYING];
    const schedule = await fetchSeasonSchedule(season);

    const rounds = schedule
        .map((r) => Number(r.round))
        .filter((r) => (fromRound === undefined || r >= fromRound) && (toRound === undefined || r <= toRound))
        .sort((a, b) => a - b);

    const samples = [];
    const skippedRaces = [];
    let racesProcessed = 0;
    const missingData = emptyMissingTotals();

    for (const round of rounds) {
        const result = await generateRaceSamples(season, round, { stages: usedStages });
        if (result.skipped) {
            skippedRaces.push({ round, reason: result.reason });
            continue;
        }
        racesProcessed += 1;
        samples.push(...result.samples);
        for (const key of Object.keys(missingData)) missingData[key] += result.missing[key] || 0;
        // A brief pause between races, not within one — each race's own
        // fetches already run concurrently. This just keeps a multi-race
        // walk from stacking straight into the next race's burst on a cold
        // cache (see DATASET_RETRY_* above for the same reasoning).
        await sleep(300);
    }

    const summary = {
        season: String(season),
        stagesGenerated: usedStages,
        racesProcessed,
        racesSkipped: skippedRaces.length,
        skippedRaces,
        driverSamplesGenerated: samples.length,
        missingData,
        leakageGuarantee:
            "every feature is scoped to rounds strictly before the labeled race, the standings as of the round before it, or (post-qualifying only, via predictionDataPolicy.sanitizeStageInputs) that race's own real pre-race qualifying result — the labeled race's own finishing result is only ever written into `outcome`, never passed to a feature computation",
    };

    return { season: String(season), samples, summary };
}

async function generateDataset({ seasons, stages, fromRound, toRound } = {}) {
    if (!Array.isArray(seasons) || seasons.length === 0) {
        throw new Error("generateDataset requires a non-empty `seasons` array");
    }

    const perSeason = [];
    for (const season of seasons) {
        perSeason.push(await generateSeasonDataset(season, { stages, fromRound, toRound }));
    }

    const samples = perSeason.flatMap((s) => s.samples);
    const summary = {
        seasons: perSeason.map((s) => s.summary),
        totalRacesProcessed: perSeason.reduce((sum, s) => sum + s.summary.racesProcessed, 0),
        totalRacesSkipped: perSeason.reduce((sum, s) => sum + s.summary.racesSkipped, 0),
        totalDriverSamples: samples.length,
        leakageGuarantee: perSeason[0]?.summary.leakageGuarantee ?? null,
    };

    return { samples, summary };
}

// Prints the Phase 2 requirement-8 checklist for one generation run:
// races processed, driver samples, missing data, skipped races, and an
// explicit statement of the leakage guarantee that produced them.
function logSummary(summary) {
    const seasons = summary.seasons ?? [summary];
    for (const s of seasons) {
        console.log(`[BacktestDataset] Season ${s.season} — races processed: ${s.racesProcessed}, skipped: ${s.racesSkipped}`);
        if (s.skippedRaces.length) {
            for (const skip of s.skippedRaces) console.log(`[BacktestDataset]   round ${skip.round} skipped: ${skip.reason}`);
        }
        console.log(`[BacktestDataset] Season ${s.season} — driver samples generated: ${s.driverSamplesGenerated}`);
        console.log(`[BacktestDataset] Season ${s.season} — missing data counts:`, s.missingData);
    }
    console.log(`[BacktestDataset] Leakage guarantee: ${seasons[0]?.leakageGuarantee}`);
}

module.exports = {
    generateRaceSamples,
    generateSeasonDataset,
    generateDataset,
    logSummary,
};
