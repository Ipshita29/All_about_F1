/*
 * ═══════════════════════════════════════════════════════════════════
 * PHASE 4 — DATASET EXPORT
 * ═══════════════════════════════════════════════════════════════════
 *
 * One-off, standalone script (not wired into the Express app, not a
 * route, not required by index.js) that reuses Phase 2/3/3.5's dataset
 * generator UNCHANGED to produce the historical driver-race dataset
 * this phase's Python evaluation pipeline reads. Also reuses
 * predictorService.buildBacktestPrediction (the real, unmodified
 * existing predictor) to capture ITS predictions for the held-out test
 * season, so "compare every model against the existing predictor" is a
 * fair comparison against the actual production algorithm, not a
 * re-implementation of it.
 *
 * Nothing in this file computes a feature, trains a model, or changes
 * predictorService.js/backtestDatasetService.js/featureEngineeringService.js
 * in any way — it only calls their existing exports (generateRaceSamples,
 * buildBacktestPrediction) and writes the result to JSON under
 * ml/artifacts/. Nothing in this phase is committed per instruction.
 *
 * PACING — scoped to THIS script only
 * backtestDatasetService.js's own internal pacing (300ms between races)
 * is tuned for its normal callers, not a 4-season bulk walk. Rather than
 * change shared Phase 2 code for one heavy, one-off script, this file
 * drives generateRaceSamples() round-by-round itself with a much longer
 * pause — the season loop this replaces is otherwise identical to
 * generateSeasonDataset's own.
 *
 * RESUMABILITY
 * Each season's result is cached to ml/artifacts/season_cache/ the
 * moment it succeeds, so a later network failure doesn't require
 * re-fetching seasons that already finished — reruns skip any season
 * whose cache file already exists.
 *
 * SPLIT DESIGN (chronological, season-level — never race-shuffled)
 *   TRAIN      2023, 2024
 *   VALIDATION 2025
 *   TEST       2026 (only rounds already completed — "do not train on
 *              the 2026 test races" is enforced by construction: 2026
 *              is never in the train/validation season list below)
 *
 * Run: node ml/export_dataset.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { getJson } = require("../services/jolpicaClient");
const { generateRaceSamples } = require("../services/backtestDatasetService");
const { buildBacktestPrediction } = require("../services/predictorService");

const TRAIN_SEASONS = ["2023", "2024"];
const VALIDATION_SEASONS = ["2025"];
const TEST_SEASONS = ["2026"];

const ARTIFACT_DIR = path.join(__dirname, "artifacts");
const SEASON_CACHE_DIR = path.join(ARTIFACT_DIR, "season_cache");
const OUT_PATH = path.join(ARTIFACT_DIR, "dataset.json");

const RACE_PAUSE_MS = 3000; // deliberately much gentler than backtestDatasetService's own 300ms
const ROUND_RETRY_ATTEMPTS = 4;
const ROUND_RETRY_COOLDOWN_MS = 15000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSeasonRounds(season) {
    const data = await getJson(`/${season}.json?limit=100`);
    return (data.MRData.RaceTable.Races || []).map((r) => Number(r.round)).sort((a, b) => a - b);
}

function emptyMissing() {
    return { standings: 0, teammate: 0, recentForm: 0, circuitHistory: 0, qualifying: 0, sprint: 0, weather: 0 };
}

async function generateSeasonManually(season) {
    const rounds = await fetchSeasonRounds(season);
    console.log(`[Export]   ${rounds.length} rounds on the ${season} schedule`);

    const samples = [];
    const skippedRaces = [];
    let racesProcessed = 0;
    const missingData = emptyMissing();

    for (const round of rounds) {
        let result = null;
        for (let attempt = 1; attempt <= ROUND_RETRY_ATTEMPTS; attempt++) {
            try {
                result = await generateRaceSamples(season, round, {});
                break;
            } catch (error) {
                console.log(`[Export]   round ${round} attempt ${attempt}/${ROUND_RETRY_ATTEMPTS} failed: ${error.message}`);
                if (attempt < ROUND_RETRY_ATTEMPTS) await sleep(ROUND_RETRY_COOLDOWN_MS);
            }
        }

        if (!result) {
            skippedRaces.push({ round, reason: "fetch_failed_after_retries" });
        } else if (result.skipped) {
            skippedRaces.push({ round, reason: result.reason });
        } else {
            racesProcessed += 1;
            samples.push(...result.samples);
            for (const key of Object.keys(missingData)) missingData[key] += result.missing[key] || 0;
            console.log(`[Export]   round ${round} (${result.raceName}) -> ${result.samples.length} samples`);
        }
        await sleep(RACE_PAUSE_MS);
    }

    const summary = {
        season: String(season),
        racesProcessed,
        racesSkipped: skippedRaces.length,
        skippedRaces,
        driverSamplesGenerated: samples.length,
        missingData,
    };
    return { samples, summary };
}

function seasonCachePath(splitName, season) {
    return path.join(SEASON_CACHE_DIR, `${splitName}_${season}.json`);
}

async function generateSplit(seasons, splitName) {
    const samples = [];
    const summaries = [];
    for (const season of seasons) {
        const cachePath = seasonCachePath(splitName, season);
        if (fs.existsSync(cachePath)) {
            console.log(`\n[Export] === ${splitName}: season ${season} (cached, skipping fetch) ===`);
            const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
            samples.push(...cached.samples);
            summaries.push(cached.summary);
            continue;
        }

        console.log(`\n[Export] === ${splitName}: season ${season} ===`);
        const { samples: seasonSamples, summary } = await generateSeasonManually(season);
        console.log(`[Export]   season ${season} done: processed=${summary.racesProcessed} skipped=${summary.racesSkipped} samples=${seasonSamples.length}`);

        const tagged = seasonSamples.map((s) => ({ ...s, split: splitName }));
        fs.mkdirSync(SEASON_CACHE_DIR, { recursive: true });
        fs.writeFileSync(cachePath, JSON.stringify({ samples: tagged, summary }));

        samples.push(...tagged);
        summaries.push(summary);
    }
    return { samples, summaries };
}

// Existing (production, unmodified) predictor's own predictions for every
// completed round in the TEST season — used later purely as one more
// model to compare against, never as training data.
async function collectExistingPredictorPredictions(rounds, season) {
    const cachePath = path.join(SEASON_CACHE_DIR, `existing_predictor_${season}.json`);
    if (fs.existsSync(cachePath)) {
        console.log(`[Export]   existing predictor predictions (cached, skipping)`);
        return JSON.parse(fs.readFileSync(cachePath, "utf8"));
    }

    const byRound = {};
    for (const round of rounds) {
        try {
            const result = await buildBacktestPrediction(season, round);
            if (result?.error) {
                console.log(`[Export]   existing predictor: round ${round} -> ${result.error}`);
                continue;
            }
            byRound[round] = result.predictions.map((p) => ({
                driverId: p.driverId,
                predictedPosition: p.predictedPosition,
            }));
            console.log(`[Export]   existing predictor: round ${round} -> ${result.predictions.length} predictions captured`);
        } catch (error) {
            console.log(`[Export]   existing predictor: round ${round} -> failed (${error.message})`);
        }
        await sleep(RACE_PAUSE_MS);
    }

    fs.writeFileSync(cachePath, JSON.stringify(byRound));
    return byRound;
}

async function main() {
    await connectDB();

    const train = await generateSplit(TRAIN_SEASONS, "train");
    const validation = await generateSplit(VALIDATION_SEASONS, "validation");
    const test = await generateSplit(TEST_SEASONS, "test");

    const testRounds = [...new Set(test.samples.map((s) => Number(s.round)))].sort((a, b) => a - b);
    console.log(`\n[Export] Collecting existing-predictor predictions for ${TEST_SEASONS[0]} rounds: ${testRounds.join(", ")}`);
    const existingPredictorPredictions = await collectExistingPredictorPredictions(testRounds, TEST_SEASONS[0]);

    const allSamples = [...train.samples, ...validation.samples, ...test.samples];

    const payload = {
        generatedAt: new Date().toISOString(),
        splitDefinition: { train: TRAIN_SEASONS, validation: VALIDATION_SEASONS, test: TEST_SEASONS },
        summaries: { train: train.summaries, validation: validation.summaries, test: test.summaries },
        existingPredictorPredictions: { season: TEST_SEASONS[0], byRound: existingPredictorPredictions },
        sampleCount: allSamples.length,
        samples: allSamples,
    };

    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(payload));

    console.log(`\n[Export] Wrote ${allSamples.length} samples to ${OUT_PATH}`);
    console.log(`[Export] train=${train.samples.length} validation=${validation.samples.length} test=${test.samples.length}`);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch((error) => {
    console.error("[Export] FAILED:", error);
    process.exit(1);
});
