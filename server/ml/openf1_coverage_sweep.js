/*
 * ═══════════════════════════════════════════════════════════════════
 * PHASE 7 — OPENF1 COVERAGE SWEEP
 * ═══════════════════════════════════════════════════════════════════
 *
 * Phase 6 established that OpenF1 (api.openf1.org) is free, keyless, and
 * has real historical lap/sector/tyre/pit-stop data from 2023 onward —
 * but only spot-checked two sessions. Before anything in this project
 * depends on it, this script checks EVERY race already in our existing
 * 2023-2026 dataset (ml/artifacts/dataset_phase5.json, built by Phase
 * 2-5, unmodified) against OpenF1's actual coverage.
 *
 * This is a standalone, offline investigation script — same ml/
 * convention as export_dataset.js/compute_race_pace_features.js. It does
 * NOT compute an ML feature, does NOT train anything, does NOT touch
 * predictorService.js / backtestDatasetService.js / the live F1 SignalR
 * timing system / any Jolpica-backed route. It only reads the existing
 * dataset's race list and calls the new openf1Client.js (a thin fetch
 * wrapper, same shape as jolpicaClient.js) to check what's there.
 *
 * MATCHING OUR RACES TO OPENF1 SESSIONS
 * OpenF1 identifies sessions by session_key/meeting_key, not by
 * season+round — there is no shared identifier with Jolpica. One
 * `/sessions?year=X&session_name=Race` call per season (confirmed live
 * in Phase 6 to return the WHOLE season's race sessions in one request)
 * is matched against Jolpica's own `/X.json` schedule (one call per
 * season, via the shared jolpicaClient — not a new API client) by exact
 * calendar date, which is unambiguous within a season even when multiple
 * races share a country name (e.g. three 2023 US races) or circuit
 * region (e.g. Imola vs Monza, both "Italy").
 *
 * CACHING (ml/artifacts/openf1_cache/, gitignored like the rest of
 * ml/artifacts/) — every raw response (season schedules, season session
 * lists, and each session's laps/stints/pit) is cached to its own file
 * the moment it's fetched. A resumed run skips anything already on disk
 * instead of re-fetching it — same resumability pattern
 * export_dataset.js/backfill_dataset.js already established for Jolpica.
 *
 * FAIR USE — sequential, not parallel. One race at a time, one OpenF1
 * call at a time within a race (laps, then stints, then pit — never
 * Promise.all'd together), with a pause after every call and a longer
 * pause between races. Slower than this project's Jolpica fetches
 * (which legitimately parallelize within one race), but OpenF1's free
 * tier has no documented request budget the way Jolpica's does, so this
 * errs conservative rather than finding its limit by tripping it.
 *
 * Run: node ml/openf1_coverage_sweep.js
 */

const fs = require("fs");
const path = require("path");
const { getJsonRetry } = require("../services/openf1Client");
const { getJson: jolpicaGetJson } = require("../services/jolpicaClient");

const ARTIFACT_DIR = path.join(__dirname, "artifacts");
const CACHE_DIR = path.join(ARTIFACT_DIR, "openf1_cache");
const DATASET_PATH = path.join(ARTIFACT_DIR, "dataset_phase5.json");
const REPORT_PATH = path.join(ARTIFACT_DIR, "openf1_coverage_report.json");

const SEASONS = ["2023", "2024", "2025", "2026"];

const CALL_PAUSE_MS = 1000;
const SESSION_PAUSE_MS = 1500;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function cachePath(name) {
    return path.join(CACHE_DIR, `${name}.json`);
}

async function cachedFetch(name, fetcher) {
    const file = cachePath(name);
    if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    }
    const data = await fetcher();
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
    return data;
}

// ---------------------------------------------------------------------------
// Our existing race list — read, never re-derived. Same dataset Phase 4/5
// already trained/evaluated against.
// ---------------------------------------------------------------------------

function loadOurRaces() {
    const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
    const races = new Map();
    for (const s of dataset.samples) {
        const key = `${s.season}|${s.round}`;
        if (!races.has(key)) races.set(key, { season: s.season, round: Number(s.round), race: s.race, circuitId: s.circuitId });
    }
    return [...races.values()].sort((a, b) => a.season.localeCompare(b.season) || a.round - b.round);
}

// ---------------------------------------------------------------------------
// Jolpica schedule (dates) — one call per season, via the EXISTING shared
// jolpicaClient, not a new client. This is the same endpoint
// backtestDatasetService.fetchSeasonSchedule already calls; re-fetching it
// here (rather than importing that function) keeps this script fully
// decoupled from the dataset-generation module it's validating a NEW data
// source for.
// ---------------------------------------------------------------------------

async function fetchJolpicaSeasonDates(season) {
    return cachedFetch(`jolpica_schedule_${season}`, async () => {
        const data = await jolpicaGetJson(`/${season}.json?limit=100`);
        const races = data.MRData.RaceTable.Races || [];
        const byRound = {};
        for (const r of races) byRound[Number(r.round)] = r.date;
        return byRound;
    });
}

async function fetchOpenF1SeasonSessions(season) {
    return cachedFetch(`openf1_sessions_${season}`, async () => {
        await sleep(CALL_PAUSE_MS);
        return getJsonRetry(`/sessions?year=${season}&session_name=Race`, RETRY_ATTEMPTS, RETRY_DELAY_MS);
    });
}

// ---------------------------------------------------------------------------
// Per-session coverage checks
// ---------------------------------------------------------------------------

async function fetchSessionData(sessionKey) {
    const laps = await cachedFetch(`session_${sessionKey}_laps`, async () => {
        await sleep(CALL_PAUSE_MS);
        try {
            return await getJsonRetry(`/laps?session_key=${sessionKey}`, RETRY_ATTEMPTS, RETRY_DELAY_MS);
        } catch {
            return [];
        }
    });

    const stints = await cachedFetch(`session_${sessionKey}_stints`, async () => {
        await sleep(CALL_PAUSE_MS);
        try {
            return await getJsonRetry(`/stints?session_key=${sessionKey}`, RETRY_ATTEMPTS, RETRY_DELAY_MS);
        } catch {
            return [];
        }
    });

    const pit = await cachedFetch(`session_${sessionKey}_pit`, async () => {
        await sleep(CALL_PAUSE_MS);
        try {
            return await getJsonRetry(`/pit?session_key=${sessionKey}`, RETRY_ATTEMPTS, RETRY_DELAY_MS);
        } catch {
            return [];
        }
    });

    return { laps, stints, pit };
}

function hasSectorData(laps) {
    return laps.some((l) => l.duration_sector_1 !== null && l.duration_sector_1 !== undefined);
}

function hasTyreData(stints) {
    return stints.some((s) => s.compound);
}

function classifyCoverage({ lapCount, stintCount, pitCount, sectorData, tyreData }) {
    if (lapCount === 0 && stintCount === 0 && pitCount === 0) return "no_data";
    const complete = lapCount > 0 && stintCount > 0 && pitCount > 0 && sectorData && tyreData;
    return complete ? "complete" : "partial";
}

module.exports = {
    loadOurRaces, fetchJolpicaSeasonDates, fetchOpenF1SeasonSessions, fetchSessionData,
    hasSectorData, hasTyreData, classifyCoverage, SEASONS, REPORT_PATH,
};
