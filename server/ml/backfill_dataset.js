/*
 * PHASE 4 — TARGETED BACKFILL
 *
 * export_dataset.js's first full run skipped 18 rounds (out of ~95) with
 * reason "insufficient_historical_standings" — NOT genuinely missing
 * data, but a transient Jolpica 429 that got silently swallowed inside
 * backtestDatasetService.fetchStandingsAsOf's own `.catch(() => null)`
 * (an existing, unmodified Phase 2 behavior: a retry-exhausted standings
 * fetch returns an empty array rather than throwing, so it reads as "no
 * historical standings" instead of "the fetch failed"). Every OTHER skip
 * reason (round 1's "no_prior_standings", 2026's late-round
 * "race_not_completed") is genuine and correctly left alone.
 *
 * This script re-attempts ONLY those specific rounds, one at a time,
 * with long pauses and many retries — the rounds themselves are few, so
 * this can afford to be far more patient than the original bulk walk.
 * Successes are merged into the existing season_cache files (and the
 * final dataset.json is rebuilt from them) — nothing already successful
 * is re-fetched or altered.
 *
 * Run: node ml/backfill_dataset.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { generateRaceSamples } = require("../services/backtestDatasetService");
const { buildBacktestPrediction } = require("../services/predictorService");

const ARTIFACT_DIR = path.join(__dirname, "artifacts");
const SEASON_CACHE_DIR = path.join(ARTIFACT_DIR, "season_cache");
const OUT_PATH = path.join(ARTIFACT_DIR, "dataset.json");

const ROUND_PAUSE_MS = 6000;
const ROUND_RETRY_ATTEMPTS = 6;
const ROUND_RETRY_COOLDOWN_MS = 25000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const TARGETS = [
    { file: "train_2023.json", split: "train", season: "2023", rounds: [21] },
    { file: "train_2024.json", split: "train", season: "2024", rounds: [17, 18, 20, 22, 24] },
    { file: "validation_2025.json", split: "validation", season: "2025", rounds: [2, 4, 6, 9, 12] },
    { file: "test_2026.json", split: "test", season: "2026", rounds: [4, 5, 7, 8, 10, 14, 15] },
];

async function retryRound(season, round) {
    for (let attempt = 1; attempt <= ROUND_RETRY_ATTEMPTS; attempt++) {
        try {
            const result = await generateRaceSamples(season, round, {});
            if (!result.skipped) return result;
            console.log(`[Backfill]   ${season}/${round} attempt ${attempt}: still skipped (${result.reason})`);
        } catch (error) {
            console.log(`[Backfill]   ${season}/${round} attempt ${attempt}: threw (${error.message})`);
        }
        if (attempt < ROUND_RETRY_ATTEMPTS) await sleep(ROUND_RETRY_COOLDOWN_MS);
    }
    return null;
}

async function main() {
    await connectDB();

    for (const target of TARGETS) {
        const cachePath = path.join(SEASON_CACHE_DIR, target.file);
        const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
        let recovered = 0;

        for (const round of target.rounds) {
            console.log(`\n[Backfill] ${target.season}/${round} (${target.split})`);
            const result = await retryRound(target.season, round);
            if (!result) {
                console.log(`[Backfill]   ${target.season}/${round} still unrecoverable after ${ROUND_RETRY_ATTEMPTS} attempts — leaving skipped`);
                await sleep(ROUND_PAUSE_MS);
                continue;
            }

            const tagged = result.samples.map((s) => ({ ...s, split: target.split }));
            cached.samples.push(...tagged);
            cached.summary.racesProcessed += 1;
            cached.summary.racesSkipped -= 1;
            cached.summary.skippedRaces = cached.summary.skippedRaces.filter((s) => s.round !== round);
            cached.summary.driverSamplesGenerated += tagged.length;
            for (const key of Object.keys(cached.summary.missingData)) {
                cached.summary.missingData[key] += result.missing[key] || 0;
            }
            recovered += 1;
            console.log(`[Backfill]   ${target.season}/${round} (${result.raceName}) recovered -> ${tagged.length} samples`);
            await sleep(ROUND_PAUSE_MS);
        }

        fs.writeFileSync(cachePath, JSON.stringify(cached));
        console.log(`[Backfill] ${target.file}: recovered ${recovered}/${target.rounds.length} rounds`);
    }

    // Rebuild dataset.json from the (now-updated) season_cache files.
    const allSamples = [];
    const files = ["train_2023.json", "train_2024.json", "validation_2025.json", "test_2026.json"];
    for (const file of files) {
        const cached = JSON.parse(fs.readFileSync(path.join(SEASON_CACHE_DIR, file), "utf8"));
        allSamples.push(...cached.samples);
    }

    // Re-collect existing-predictor predictions for any 2026 test rounds
    // recovered above that weren't captured in the first pass.
    const existingCachePath = path.join(SEASON_CACHE_DIR, "existing_predictor_2026.json");
    const existingPredictions = JSON.parse(fs.readFileSync(existingCachePath, "utf8"));
    const test2026Rounds = [...new Set(allSamples.filter((s) => s.season === "2026").map((s) => Number(s.round)))].sort((a, b) => a - b);
    for (const round of test2026Rounds) {
        if (existingPredictions[round]) continue;
        console.log(`[Backfill] existing predictor: round ${round} not yet captured, fetching...`);
        try {
            const result = await buildBacktestPrediction("2026", round);
            if (!result?.error) {
                existingPredictions[round] = result.predictions.map((p) => ({ driverId: p.driverId, predictedPosition: p.predictedPosition }));
                console.log(`[Backfill]   round ${round} -> ${result.predictions.length} predictions captured`);
            }
        } catch (error) {
            console.log(`[Backfill]   round ${round} -> failed (${error.message})`);
        }
        await sleep(ROUND_PAUSE_MS);
    }
    fs.writeFileSync(existingCachePath, JSON.stringify(existingPredictions));

    const payload = {
        generatedAt: new Date().toISOString(),
        splitDefinition: { train: ["2023", "2024"], validation: ["2025"], test: ["2026"] },
        existingPredictorPredictions: { season: "2026", byRound: existingPredictions },
        sampleCount: allSamples.length,
        samples: allSamples,
    };
    fs.writeFileSync(OUT_PATH, JSON.stringify(payload));

    console.log(`\n[Backfill] Rebuilt dataset.json: ${allSamples.length} total samples`);
    const bySplit = {};
    for (const s of allSamples) bySplit[s.split] = (bySplit[s.split] || 0) + 1;
    console.log(`[Backfill] by split:`, bySplit);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch((error) => {
    console.error("[Backfill] FAILED:", error);
    process.exit(1);
});
