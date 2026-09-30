/*
 * ═══════════════════════════════════════════════════════════════════
 * PHASE 5 — RACE-PACE FEATURE AUGMENTATION
 * ═══════════════════════════════════════════════════════════════════
 *
 * Phase 4's finding: championshipStandingScore and gridPosition dominate
 * feature importance; everything else (recent form, circuit, sprint,
 * weather, ...) contributes little. This script adds the 5 genuinely NEW
 * race-pace features Phase 5 asks for — short-window (3-race) and
 * qualifying-specific rolling teammate/constructor comparisons that
 * Phase 3 never computed — and attaches them to the EXISTING Phase 4
 * dataset (ml/artifacts/dataset.json) rather than regenerating it from
 * scratch: the 30 existing features per row are untouched and reused
 * as-is (no re-fetch, no re-derivation), only 5 new columns are added.
 *
 * WHY A SEPARATE, STANDALONE SCRIPT — not an edit to
 * backtestDatasetService.js/featureEngineeringService.js
 * Every prior phase's instructions have been "preserve the existing
 * architecture, only add." This phase goes one step further: it doesn't
 * touch those files AT ALL, not even additively. It reuses their exports
 * (predictorService.fetchRecentResults/fetchQualifying, already exported
 * since Phase 2) directly, so the underlying data-fetching logic is
 * identical to what Phase 2/3 already use — never re-implemented — while
 * the wiring stays entirely inside ml/, next to Phase 4's own scripts.
 *
 * WHAT'S GENUINELY NEW vs WHAT PHASE 3 ALREADY HAD
 *   teammateRaceDeltaLast3        NEW  (Phase 3's teammateRaceDelta IS
 *                                       the 5-race version — unchanged,
 *                                       reused as "Last5" here)
 *   teammateQualifyingDeltaLast3  NEW  (Phase 3 only had a delta for the
 *   teammateQualifyingDeltaLast5  NEW   TARGET race's own qualifying —
 *                                       gated POST_QUALIFYING-only. THESE
 *                                       are rolling history from PAST
 *                                       races' qualifying, available at
 *                                       BOTH stages — see LEAKAGE below.)
 *   teammatePointsDeltaLast3      NEW  (Phase 3's teammatePointsDelta is
 *                                       the 5-race version — unchanged,
 *                                       reused as "Last5" here)
 *   constructorRecentQualifyingAvgLast5  NEW (Phase 3's
 *                                       constructorQualifyingAvgPosition
 *                                       is for the TARGET race's own
 *                                       qualifying, POST-only. This is
 *                                       rolling history instead.)
 * "recent race performance" (constructorRecentAvgFinish) and
 * "constructor trend" (constructorRecentTrend) were already computed by
 * Phase 3 and are reused unchanged — no new feature needed for those.
 *
 * LEAKAGE
 * Every new feature is built from PAST races' results/qualifying —
 * `fetchRecentResults`/`fetchQualifying` calls for rounds STRICTLY
 * BEFORE the target round (same leakage-safe contract Phase 2 already
 * established and reuses unchanged). Because these are historical facts
 * about races that already happened, they are NOT gated by
 * predictionDataPolicy's qualifying-stage rule the way the TARGET race's
 * OWN qualifying result is — that rule exists specifically to keep the
 * race being predicted's own qualifying out of a PRE_QUALIFYING sample,
 * not to hide public history about past races (recentForm/circuitHistory
 * are exactly this same kind of historical, both-stage-available data).
 * All 5 new features are therefore computed once per (season, round,
 * driver) and applied identically to both stage rows for that
 * driver/race — verified below.
 *
 * Run: node ml/compute_race_pace_features.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { fetchRecentResults, fetchQualifying, RECENT_FORM_RACE_COUNT } = require("../services/predictorService");

const IN_PATH = path.join(__dirname, "artifacts", "dataset.json");
const OUT_PATH = path.join(__dirname, "artifacts", "dataset_phase5.json");
const RACE_CACHE_DIR = path.join(__dirname, "artifacts", "race_pace_cache");

const ROUND_PAUSE_MS = 3000;
const RETRY_ATTEMPTS = 5;
const RETRY_COOLDOWN_MS = 15000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function mean(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function round2(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return null;
    return Math.round(n * 100) / 100;
}

function findResult(race, driverId) {
    return race.results.find((r) => r.Driver.driverId === driverId) || null;
}

// ---------------------------------------------------------------------------
// New fetch — mirrors predictorService.fetchRecentResults's exact pattern
// (same round-scoping, same most-recent-first ordering) but for qualifying
// history instead of race results. Reuses fetchQualifying per past round —
// not a new API client, not a new leakage rule, just the existing
// per-round qualifying fetch called across a window of past rounds.
// ---------------------------------------------------------------------------
async function fetchRecentQualifying(season, uptoRound, count) {
    const rounds = [];
    for (let r = uptoRound - 1; r >= 1 && rounds.length < count; r--) rounds.push(r);
    if (rounds.length === 0) return [];

    return Promise.all(
        rounds.map((round) =>
            fetchQualifying(season, round)
                .then((results) => ({ round, results }))
                .catch(() => ({ round, results: [] }))
        )
    );
}

// ---------------------------------------------------------------------------
// New race-pace feature computations
// ---------------------------------------------------------------------------

function avgRaceDelta(driverId, teammateId, recentRaces, n) {
    if (!teammateId) return null;
    const deltas = [];
    for (const race of recentRaces.slice(0, n)) {
        const mine = findResult(race, driverId);
        const theirs = findResult(race, teammateId);
        if (!mine || !theirs) continue;
        const myPos = Number(mine.position);
        const theirPos = Number(theirs.position);
        if (Number.isNaN(myPos) || Number.isNaN(theirPos)) continue;
        deltas.push(theirPos - myPos); // positive = ahead of teammate
    }
    return deltas.length ? round2(mean(deltas)) : null;
}

function avgPointsDelta(driverId, teammateId, recentRaces, n) {
    if (!teammateId) return null;
    const deltas = [];
    for (const race of recentRaces.slice(0, n)) {
        const mine = findResult(race, driverId);
        const theirs = findResult(race, teammateId);
        if (!mine || !theirs) continue;
        deltas.push((Number(mine.points) || 0) - (Number(theirs.points) || 0));
    }
    return deltas.length ? round2(mean(deltas)) : null;
}

function avgQualifyingDelta(driverId, teammateId, recentQuali, n) {
    if (!teammateId) return null;
    const deltas = [];
    for (const race of recentQuali.slice(0, n)) {
        const mine = findResult(race, driverId);
        const theirs = findResult(race, teammateId);
        if (!mine || !theirs) continue;
        const myPos = Number(mine.position);
        const theirPos = Number(theirs.position);
        if (Number.isNaN(myPos) || Number.isNaN(theirPos)) continue;
        deltas.push(theirPos - myPos);
    }
    return deltas.length ? round2(mean(deltas)) : null;
}

function constructorRecentQualifyingAvg(teamId, teamRoster, recentQuali, n) {
    const mates = teamRoster.get(teamId) || [];
    const positions = [];
    for (const race of recentQuali.slice(0, n)) {
        for (const mate of mates) {
            const r = findResult(race, mate);
            const pos = r ? Number(r.position) : NaN;
            if (!Number.isNaN(pos)) positions.push(pos);
        }
    }
    return positions.length ? round2(mean(positions)) : null;
}

// ---------------------------------------------------------------------------
// Per-race processing
// ---------------------------------------------------------------------------

function raceCachePath(season, round) {
    return path.join(RACE_CACHE_DIR, `${season}_${round}.json`);
}

async function computeRaceFeatures(season, round, driverTeamMap) {
    const cachePath = raceCachePath(season, round);
    if (fs.existsSync(cachePath)) {
        return JSON.parse(fs.readFileSync(cachePath, "utf8"));
    }

    let recentRaces, recentQuali;
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
            [recentRaces, recentQuali] = await Promise.all([
                fetchRecentResults(season, round, RECENT_FORM_RACE_COUNT),
                fetchRecentQualifying(season, round, RECENT_FORM_RACE_COUNT),
            ]);
            break;
        } catch (error) {
            console.log(`[Phase5]   ${season}/${round} attempt ${attempt} failed: ${error.message}`);
            if (attempt < RETRY_ATTEMPTS) await sleep(RETRY_COOLDOWN_MS);
        }
    }
    if (!recentRaces) recentRaces = [];
    if (!recentQuali) recentQuali = [];

    // Teammate pairing from the actual entrants in THIS race (already
    // recorded in dataset.json's own driverId/constructorId columns —
    // same source-of-truth Phase 2 used, no re-fetch needed for this part).
    const teamRoster = new Map();
    for (const [driverId, teamId] of driverTeamMap.entries()) {
        if (!teamId) continue;
        if (!teamRoster.has(teamId)) teamRoster.set(teamId, []);
        teamRoster.get(teamId).push(driverId);
    }

    const perDriver = {};
    for (const [driverId, teamId] of driverTeamMap.entries()) {
        const teammateId = (teamRoster.get(teamId) || []).find((id) => id !== driverId) || null;
        perDriver[driverId] = {
            teammateRaceDeltaLast3: avgRaceDelta(driverId, teammateId, recentRaces, 3),
            teammateQualifyingDeltaLast3: avgQualifyingDelta(driverId, teammateId, recentQuali, 3),
            teammateQualifyingDeltaLast5: avgQualifyingDelta(driverId, teammateId, recentQuali, 5),
            teammatePointsDeltaLast3: avgPointsDelta(driverId, teammateId, recentRaces, 3),
            constructorRecentQualifyingAvgLast5: constructorRecentQualifyingAvg(teamId, teamRoster, recentQuali, 5),
        };
    }

    fs.mkdirSync(RACE_CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(perDriver));
    return perDriver;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const dataset = JSON.parse(fs.readFileSync(IN_PATH, "utf8"));
    const samples = dataset.samples;

    // Group by (season, round) so each race's new features are computed
    // once and applied to every driver/stage row for that race.
    const races = new Map(); // "season|round" -> { season, round, driverTeamMap }
    for (const s of samples) {
        const key = `${s.season}|${s.round}`;
        if (!races.has(key)) races.set(key, { season: s.season, round: s.round, driverTeamMap: new Map() });
        races.get(key).driverTeamMap.set(s.driverId, s.constructorId);
    }

    console.log(`[Phase5] ${races.size} unique races to process`);

    let processed = 0;
    for (const { season, round, driverTeamMap } of races.values()) {
        const perDriver = await computeRaceFeatures(season, round, driverTeamMap);
        for (const s of samples) {
            if (s.season !== season || s.round !== round) continue;
            const newFeatures = perDriver[s.driverId] || {};
            s.mlFeatures = { ...s.mlFeatures, ...newFeatures };
            for (const key of Object.keys(newFeatures)) {
                s.mlFeatureAvailability = { ...s.mlFeatureAvailability, [key]: newFeatures[key] !== null };
            }
        }
        processed += 1;
        if (processed % 10 === 0 || processed === races.size) {
            console.log(`[Phase5] processed ${processed}/${races.size} races`);
        }
        await sleep(ROUND_PAUSE_MS);
    }

    dataset.generatedAt = new Date().toISOString();
    dataset.phase5FeaturesAdded = [
        "teammateRaceDeltaLast3",
        "teammateQualifyingDeltaLast3",
        "teammateQualifyingDeltaLast5",
        "teammatePointsDeltaLast3",
        "constructorRecentQualifyingAvgLast5",
    ];
    fs.writeFileSync(OUT_PATH, JSON.stringify(dataset));
    console.log(`\n[Phase5] Wrote augmented dataset to ${OUT_PATH} (${samples.length} samples, ${dataset.phase5FeaturesAdded.length} new features per row)`);
}

main().catch((error) => {
    console.error("[Phase5] FAILED:", error);
    process.exit(1);
});
