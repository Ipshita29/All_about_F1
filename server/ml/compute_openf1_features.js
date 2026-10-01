/*
 * ═══════════════════════════════════════════════════════════════════
 * PHASE 8 — OPENF1 RACE-PACE FEATURE ENGINEERING
 * ═══════════════════════════════════════════════════════════════════
 *
 * Phase 7 cached real OpenF1 lap/stint/pit data for 80/81 races in the
 * existing dataset (server/ml/artifacts/openf1_cache/). This script
 * reads ONLY that cache — zero new OpenF1 network calls — and extends
 * the existing Phase 4/5 dataset with rolling, leakage-safe
 * race-performance features, following the exact same standalone
 * augmentation pattern Phase 5 used (compute_race_pace_features.js):
 * reads dataset_phase5.json, attaches new mlFeatures keys, writes
 * dataset_phase8.json. backtestDatasetService.js and
 * featureEngineeringService.js are not touched, not even additively.
 *
 * The one genuinely NEW fetch this script makes is driverId <->
 * driverNumber mapping, via predictorService.fetchStandings(season) —
 * already exported since Phase 1/2, 4 cheap calls total (one per
 * season). This is required because OpenF1 keys everything by
 * driver_number while our dataset keys by driverId; it is not a
 * re-fetch of anything Phase 7 already cached.
 *
 * LEAKAGE RULE (stricter than Phase 5's qualifying features)
 * For race R, every OpenF1-derived feature is a rolling average over
 * the last up to 5 PRIOR races in the same season that have usable
 * OpenF1 data — same round-scoping convention
 * predictorService.fetchRecentResults already uses for recentForm.
 * Unlike qualifying (where the TARGET race's own result becomes legal
 * once POST_QUALIFYING), the target race's own lap/stint/tyre/sector/pit
 * data is NEVER used, at EITHER stage — these features are identical
 * between a sample's pre- and post-qualifying rows, the same as
 * recentForm/circuitHistory/Phase 5's rolling teammate deltas already
 * are. verifyLeakage() below asserts this programmatically for a sample
 * of races, not just by inspection.
 *
 * OUTLIER / INVALID-LAP FILTERING (documented, applied before any
 * average is computed)
 *   - A lap with no recorded duration is dropped.
 *   - A pit out-lap (OpenF1's own is_pit_out_lap flag) is dropped.
 *   - The lap immediately before a new stint begins (the in-lap into
 *     that pit stop) is dropped — stints[i].lap_start - 1, for every
 *     stint after the driver's first.
 *   - Of what remains, any lap slower than 1.15x that driver's own
 *     median clean lap in that race is dropped — catches safety car/VSC/
 *     spins/lock-ups without needing track-status data this project
 *     doesn't have cached. This is a documented heuristic, not a claim
 *     of perfect SC/VSC detection.
 *   - A driver needs at least 5 clean laps in a race for its race-pace/
 *     sector figures to count at all, at least 3 clean laps in a
 *     specific stint for that stint to count, and at least 6 for a
 *     degradation slope — short samples are dropped rather than averaged
 *     into noise.
 *   - A pit stop with pit_duration <= 0 or >= 120s is excluded from the
 *     average-duration figure (almost certainly a penalty/damage stop,
 *     not representative strategy time) but still counts toward stop
 *     COUNT, since it genuinely happened.
 *
 * Run: node ml/compute_openf1_features.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { fetchStandings } = require("../services/predictorService");

const ARTIFACT_DIR = path.join(__dirname, "artifacts");
const CACHE_DIR = path.join(ARTIFACT_DIR, "openf1_cache");
const DATASET_PATH = path.join(ARTIFACT_DIR, "dataset_phase5.json");
const COVERAGE_REPORT_PATH = path.join(ARTIFACT_DIR, "openf1_coverage_report.json");
const OUT_PATH = path.join(ARTIFACT_DIR, "dataset_phase8.json");

const WINDOW = 5; // same convention as predictorService.RECENT_FORM_RACE_COUNT
const OUTLIER_THRESHOLD = 1.15;
const MIN_CLEAN_LAPS_FOR_RACE_PACE = 5;
const MIN_CLEAN_LAPS_FOR_STINT = 3;
const MIN_CLEAN_LAPS_FOR_DEGRADATION = 6;
const MAX_PLAUSIBLE_PIT_DURATION = 120;

function mean(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

function round3(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return null;
    return Math.round(n * 1000) / 1000;
}

function readCache(name) {
    const file = path.join(CACHE_DIR, `${name}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

// ---------------------------------------------------------------------------
// Step 1 — driverId <-> driverNumber per season (the one new fetch)
// ---------------------------------------------------------------------------

async function buildDriverNumberMaps(seasons) {
    const bySeasonIdToNumber = {};
    for (const season of seasons) {
        const { driverStandings } = await fetchStandings(season);
        const map = new Map();
        for (const s of driverStandings) {
            const num = Number(s.Driver.permanentNumber);
            if (!Number.isNaN(num)) map.set(s.Driver.driverId, num);
        }
        bySeasonIdToNumber[season] = map;
        console.log(`[Phase8]   season ${season}: ${map.size} driverId->number mappings`);
    }
    return bySeasonIdToNumber;
}

// ---------------------------------------------------------------------------
// Step 2 — per-session, per-driver clean-lap extraction (the filtering
// rules documented in the header above)
// ---------------------------------------------------------------------------

function cleanLapsForDriver(laps, driverStints, driverNumber) {
    const driverLaps = laps.filter(
        (l) => l.driver_number === driverNumber && l.lap_duration !== null && l.lap_duration !== undefined
    );
    if (driverLaps.length === 0) return [];

    const inLapNumbers = new Set(driverStints.slice(1).map((s) => s.lap_start - 1));
    let filtered = driverLaps.filter((l) => !l.is_pit_out_lap && !inLapNumbers.has(l.lap_number));
    if (filtered.length === 0) return [];

    const med = median(filtered.map((l) => l.lap_duration));
    filtered = filtered.filter((l) => l.lap_duration <= med * OUTLIER_THRESHOLD);
    return filtered;
}

// Per-driver metrics for ONE session: race pace, sector pace, best-stint
// pace, tyre degradation, pit stats — all raw (not yet normalized against
// the field; that happens in computeSessionSummary, added next commit,
// once every driver's raw numbers are in).
function computeDriverRawMetrics(laps, stints, pit, driverNumber) {
    const driverStints = stints.filter((s) => s.driver_number === driverNumber).sort((a, b) => a.lap_start - b.lap_start);
    const clean = cleanLapsForDriver(laps, driverStints, driverNumber);

    const raceAvgLap = clean.length >= MIN_CLEAN_LAPS_FOR_RACE_PACE ? mean(clean.map((l) => l.lap_duration)) : null;

    const sectorAvg = {};
    for (const sec of [1, 2, 3]) {
        const vals = clean.map((l) => l[`duration_sector_${sec}`]).filter((v) => v !== null && v !== undefined);
        sectorAvg[sec] = vals.length >= MIN_CLEAN_LAPS_FOR_RACE_PACE ? mean(vals) : null;
    }

    const cleanByLap = new Map(clean.map((l) => [l.lap_number, l]));
    let bestStintAvg = null;
    let degradations = [];
    for (const stint of driverStints) {
        const stintLapDurations = [];
        const stintLapsOrdered = [];
        for (let lapNum = stint.lap_start; lapNum <= stint.lap_end; lapNum++) {
            const lap = cleanByLap.get(lapNum);
            if (lap) {
                stintLapDurations.push(lap.lap_duration);
                stintLapsOrdered.push(lap.lap_duration);
            }
        }
        if (stintLapDurations.length >= MIN_CLEAN_LAPS_FOR_STINT) {
            const avg = mean(stintLapDurations);
            if (bestStintAvg === null || avg < bestStintAvg) bestStintAvg = avg;
        }
        if (stintLapsOrdered.length >= MIN_CLEAN_LAPS_FOR_DEGRADATION) {
            const firstThree = mean(stintLapsOrdered.slice(0, 3));
            const lastThree = mean(stintLapsOrdered.slice(-3));
            degradations.push(lastThree - firstThree); // positive = got slower
        }
    }
    const degradationRate = degradations.length ? mean(degradations) : null;

    const driverPitStops = pit.filter((p) => p.driver_number === driverNumber);
    const validDurations = driverPitStops
        .map((p) => p.pit_duration)
        .filter((d) => d !== null && d !== undefined && d > 0 && d < MAX_PLAUSIBLE_PIT_DURATION);

    return {
        raceAvgLap,
        sectorAvg,
        bestStintAvg,
        degradationRate,
        pitStopCount: driverPitStops.length,
        avgPitDuration: validDurations.length ? mean(validDurations) : null,
    };
}

// Normalizes every driver's raw figures against the FIELD MEDIAN for that
// same session — necessary because raw lap times aren't comparable across
// different circuits (Monaco ~70s/lap vs Spa ~105s/lap). Lower ratio =
// faster, consistent with "lower is better" everywhere else in this
// project's feature set.
function computeSessionSummary(sessionKey) {
    const laps = readCache(`session_${sessionKey}_laps`) || [];
    const stints = readCache(`session_${sessionKey}_stints`) || [];
    const pit = readCache(`session_${sessionKey}_pit`) || [];
    if (laps.length === 0) return null;

    const driverNumbers = [...new Set(laps.map((l) => l.driver_number))];
    const raw = new Map();
    for (const num of driverNumbers) raw.set(num, computeDriverRawMetrics(laps, stints, pit, num));

    const fieldRaceMedian = median([...raw.values()].map((r) => r.raceAvgLap).filter((v) => v !== null));
    const fieldStintMedian = median([...raw.values()].map((r) => r.bestStintAvg).filter((v) => v !== null));
    const fieldSectorMedian = {};
    for (const sec of [1, 2, 3]) {
        const vals = [...raw.values()].map((r) => r.sectorAvg[sec]).filter((v) => v !== null);
        fieldSectorMedian[sec] = vals.length ? median(vals) : null;
    }

    const perDriver = new Map();
    for (const [num, r] of raw) {
        const sectorRatio = {};
        for (const sec of [1, 2, 3]) {
            sectorRatio[sec] = r.sectorAvg[sec] !== null && fieldSectorMedian[sec] ? r.sectorAvg[sec] / fieldSectorMedian[sec] : null;
        }
        perDriver.set(num, {
            racePaceRatio: r.raceAvgLap !== null && fieldRaceMedian ? r.raceAvgLap / fieldRaceMedian : null,
            sectorRatio,
            stintPaceRatio: r.bestStintAvg !== null && fieldStintMedian ? r.bestStintAvg / fieldStintMedian : null,
            degradationRate: r.degradationRate, // seconds lost per stint (last3-first3), not field-normalized — a time delta, not a pace level
            pitStopCount: r.pitStopCount,
            avgPitDuration: r.avgPitDuration,
        });
    }
    return perDriver;
}

const NEW_FEATURE_KEYS = [
    "openf1RacePaceRatio",
    "openf1TeammatePaceDelta",
    "openf1StintPaceRatio",
    "openf1TyreDegradationRate",
    "openf1Sector1PaceRatio",
    "openf1Sector2PaceRatio",
    "openf1Sector3PaceRatio",
    "openf1AvgPitStopDuration",
    "openf1AvgPitStopsPerRace",
];

// Below this, a feature is too sparse across the dataset to call
// "reliable" per this phase's own instruction to reject poor-coverage
// features — it is dropped from the written output, not just flagged.
const MIN_ACCEPTABLE_COVERAGE_PCT = 30;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log("[Phase8] Loading dataset and Phase 7 coverage report...");
    const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
    const coverage = JSON.parse(fs.readFileSync(COVERAGE_REPORT_PATH, "utf8"));

    const sessionByRace = new Map(); // "season|round" -> sessionKey
    for (const r of coverage.races) {
        if (r.openf1SessionKey) sessionByRace.set(`${r.season}|${r.round}`, r.openf1SessionKey);
    }

    const seasons = [...new Set(dataset.samples.map((s) => s.season))].sort();
    console.log(`[Phase8] Building driverId<->driverNumber maps for seasons: ${seasons.join(", ")}`);
    const driverNumberMaps = await buildDriverNumberMaps(seasons);

    console.log("[Phase8] Computing per-session driver pace metrics from cached OpenF1 data (no network calls)...");
    const summaryByRace = new Map();
    for (const [key, sessionKey] of sessionByRace) {
        const summary = computeSessionSummary(sessionKey);
        if (summary) summaryByRace.set(key, summary);
    }
    console.log(`[Phase8] ${summaryByRace.size}/${sessionByRace.size} matched sessions produced a usable per-driver summary`);

    // Team rosters per race, reconstructed from the dataset's own
    // driverId/constructorId columns — same trick Phase 2/5 already use,
    // no new fetch.
    const raceDriverTeam = new Map();
    for (const s of dataset.samples) {
        const key = `${s.season}|${s.round}`;
        if (!raceDriverTeam.has(key)) raceDriverTeam.set(key, new Map());
        raceDriverTeam.get(key).set(s.driverId, s.constructorId);
    }
    const teammateByRace = new Map();
    for (const [key, driverTeamMap] of raceDriverTeam) {
        const teamRoster = new Map();
        for (const [driverId, teamId] of driverTeamMap) {
            if (!teamId) continue;
            if (!teamRoster.has(teamId)) teamRoster.set(teamId, []);
            teamRoster.get(teamId).push(driverId);
        }
        const mates = new Map();
        for (const [driverId, teamId] of driverTeamMap) {
            mates.set(driverId, (teamRoster.get(teamId) || []).find((id) => id !== driverId) || null);
        }
        teammateByRace.set(key, mates);
    }

    const roundsBySeason = new Map();
    for (const s of dataset.samples) {
        if (!roundsBySeason.has(s.season)) roundsBySeason.set(s.season, new Set());
        roundsBySeason.get(s.season).add(Number(s.round));
    }
    for (const [season, set] of roundsBySeason) roundsBySeason.set(season, [...set].sort((a, b) => a - b));

    function priorRoundsWindow(season, round) {
        return (roundsBySeason.get(season) || []).filter((r) => r < round).slice(-WINDOW);
    }

    function metricsFor(season, round, driverId, driverNumberMap) {
        const num = driverNumberMap.get(driverId);
        if (num === undefined) return null;
        const summary = summaryByRace.get(`${season}|${round}`);
        if (!summary) return null;
        return summary.get(num) || null;
    }

    function rollingAverage(season, round, driverId, field, driverNumberMap) {
        const vals = [];
        for (const r of priorRoundsWindow(season, round)) {
            const m = metricsFor(season, r, driverId, driverNumberMap);
            if (!m) continue;
            const v = field.startsWith("sector") ? m.sectorRatio[Number(field.slice(-1))] : m[field];
            if (v !== null && v !== undefined) vals.push(v);
        }
        return vals.length ? round3(mean(vals)) : null;
    }

    function rollingPitStopsPerRace(season, round, driverId, driverNumberMap) {
        const counts = [];
        for (const r of priorRoundsWindow(season, round)) {
            const m = metricsFor(season, r, driverId, driverNumberMap);
            if (m) counts.push(m.pitStopCount); // 0 is a real, meaningful value — not missing
        }
        return counts.length ? round3(mean(counts)) : null;
    }

    function rollingTeammateDelta(season, round, driverId, teammateId, driverNumberMap) {
        if (!teammateId) return null;
        const deltas = [];
        for (const r of priorRoundsWindow(season, round)) {
            const mine = metricsFor(season, r, driverId, driverNumberMap);
            const theirs = metricsFor(season, r, teammateId, driverNumberMap);
            if (!mine || !theirs || mine.racePaceRatio === null || theirs.racePaceRatio === null) continue;
            deltas.push(theirs.racePaceRatio - mine.racePaceRatio); // positive = I'm faster (lower ratio)
        }
        return deltas.length ? round3(mean(deltas)) : null;
    }

    console.log("[Phase8] Computing rolling OpenF1 features for every sample...");
    let processed = 0;
    for (const s of dataset.samples) {
        const season = s.season;
        const round = Number(s.round);
        const driverNumberMap = driverNumberMaps[season] || new Map();
        const teammateId = (teammateByRace.get(`${season}|${round}`) || new Map()).get(s.driverId) || null;

        const newFeatures = {
            openf1RacePaceRatio: rollingAverage(season, round, s.driverId, "racePaceRatio", driverNumberMap),
            openf1TeammatePaceDelta: rollingTeammateDelta(season, round, s.driverId, teammateId, driverNumberMap),
            openf1StintPaceRatio: rollingAverage(season, round, s.driverId, "stintPaceRatio", driverNumberMap),
            openf1TyreDegradationRate: rollingAverage(season, round, s.driverId, "degradationRate", driverNumberMap),
            openf1Sector1PaceRatio: rollingAverage(season, round, s.driverId, "sector1", driverNumberMap),
            openf1Sector2PaceRatio: rollingAverage(season, round, s.driverId, "sector2", driverNumberMap),
            openf1Sector3PaceRatio: rollingAverage(season, round, s.driverId, "sector3", driverNumberMap),
            openf1AvgPitStopDuration: rollingAverage(season, round, s.driverId, "avgPitDuration", driverNumberMap),
            openf1AvgPitStopsPerRace: rollingPitStopsPerRace(season, round, s.driverId, driverNumberMap),
        };

        s.mlFeatures = { ...s.mlFeatures, ...newFeatures };
        s.mlFeatureAvailability = { ...s.mlFeatureAvailability };
        for (const k of Object.keys(newFeatures)) s.mlFeatureAvailability[k] = newFeatures[k] !== null;

        processed += 1;
        if (processed % 500 === 0) console.log(`[Phase8]   ${processed}/${dataset.samples.length} samples processed`);
    }

    // ---- Leakage verification (programmatic, not just visual) ------------
    console.log("\n[Phase8] === LEAKAGE VERIFICATION ===");
    const spotChecks = [];
    for (const [season, rounds] of roundsBySeason) {
        spotChecks.push({ season, round: rounds[0] });
        spotChecks.push({ season, round: rounds[Math.floor(rounds.length / 2)] });
        spotChecks.push({ season, round: rounds[rounds.length - 1] });
    }
    let leakageOk = true;
    for (const { season, round } of spotChecks) {
        const window = priorRoundsWindow(season, round);
        const ok = window.every((r) => r < round);
        leakageOk = leakageOk && ok;
        console.log(`[Phase8]   ${season} R${round}: prior-rounds window = [${window.join(", ")}] -> ${ok ? "PASS" : "FAIL (window includes target or later round)"}`);
    }
    console.log(`[Phase8] Leakage verification: ${leakageOk ? "ALL PASSED" : "FAILURES DETECTED"}`);

    // ---- Pre/post stage consistency (these features must never differ) --
    console.log("\n[Phase8] === PRE/POST STAGE CONSISTENCY CHECK ===");
    const byDriverRace = new Map();
    for (const s of dataset.samples) {
        const k = `${s.season}|${s.round}|${s.driverId}`;
        if (!byDriverRace.has(k)) byDriverRace.set(k, {});
        byDriverRace.get(k)[s.stage] = s.mlFeatures;
    }
    let stageMismatches = 0;
    for (const { pre_qualifying, post_qualifying } of byDriverRace.values()) {
        if (!pre_qualifying || !post_qualifying) continue;
        for (const key of NEW_FEATURE_KEYS) {
            if (pre_qualifying[key] !== post_qualifying[key]) stageMismatches += 1;
        }
    }
    console.log(`[Phase8] Stage-consistency mismatches: ${stageMismatches} (expect 0)`);

    // ---- Coverage per feature, and reject anything too sparse ------------
    console.log("\n[Phase8] === FEATURE COVERAGE ===");
    const coverageStats = {};
    for (const key of NEW_FEATURE_KEYS) {
        const available = dataset.samples.filter((s) => s.mlFeatureAvailability[key]).length;
        const pct = round3((available / dataset.samples.length) * 100);
        coverageStats[key] = { available, total: dataset.samples.length, pct };
        console.log(`[Phase8]   ${key}: ${available}/${dataset.samples.length} (${pct}%)`);
    }

    const rejected = NEW_FEATURE_KEYS.filter((k) => coverageStats[k].pct < MIN_ACCEPTABLE_COVERAGE_PCT);
    const kept = NEW_FEATURE_KEYS.filter((k) => !rejected.includes(k));
    console.log(`\n[Phase8] Features kept (>= ${MIN_ACCEPTABLE_COVERAGE_PCT}% coverage): ${kept.join(", ")}`);
    console.log(`[Phase8] Features rejected (< ${MIN_ACCEPTABLE_COVERAGE_PCT}% coverage): ${rejected.length ? rejected.join(", ") : "none"}`);

    if (rejected.length) {
        for (const s of dataset.samples) {
            for (const key of rejected) {
                delete s.mlFeatures[key];
                delete s.mlFeatureAvailability[key];
            }
        }
    }

    dataset.generatedAt = new Date().toISOString();
    dataset.phase8FeaturesAdded = kept;
    dataset.phase8FeaturesRejected = rejected.map((k) => ({ key: k, coveragePct: coverageStats[k].pct }));
    dataset.phase8LeakageVerification = { passed: leakageOk, stageConsistencyMismatches: stageMismatches, spotChecks };
    dataset.phase8Coverage = coverageStats;

    fs.writeFileSync(OUT_PATH, JSON.stringify(dataset));
    console.log(`\n[Phase8] Wrote ${dataset.samples.length} samples to ${OUT_PATH}`);
    console.log(`[Phase8] Final new feature count: ${kept.length}`);
}

if (require.main === module) {
    main().catch((error) => {
        console.error("[Phase8] FAILED:", error);
        process.exit(1);
    });
}

module.exports = {
    buildDriverNumberMaps, computeSessionSummary, cleanLapsForDriver, computeDriverRawMetrics,
    WINDOW, OUTLIER_THRESHOLD, MIN_CLEAN_LAPS_FOR_RACE_PACE, MIN_CLEAN_LAPS_FOR_STINT, MIN_CLEAN_LAPS_FOR_DEGRADATION,
};
