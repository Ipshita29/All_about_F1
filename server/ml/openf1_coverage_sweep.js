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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const ourRaces = loadOurRaces();
    console.log(`[OpenF1 Sweep] ${ourRaces.length} races in the existing dataset to check`);

    const racesBySeason = new Map();
    for (const r of ourRaces) {
        if (!racesBySeason.has(r.season)) racesBySeason.set(r.season, []);
        racesBySeason.get(r.season).push(r);
    }

    const report = [];
    let matched = 0;
    let unmatched = 0;

    for (const season of SEASONS) {
        const races = racesBySeason.get(season) || [];
        if (races.length === 0) continue;

        console.log(`\n[OpenF1 Sweep] === Season ${season}: ${races.length} races ===`);
        const jolpicaDates = await fetchJolpicaSeasonDates(season);
        const openf1Sessions = await fetchOpenF1SeasonSessions(season);

        // date (YYYY-MM-DD) -> session_key, from OpenF1's own date_start
        const sessionByDate = new Map();
        for (const s of openf1Sessions) {
            if (s.date_start) sessionByDate.set(s.date_start.slice(0, 10), s);
        }

        for (const r of races) {
            const jolpicaDate = jolpicaDates[r.round];
            const session = jolpicaDate ? sessionByDate.get(jolpicaDate) : null;

            if (!session) {
                unmatched += 1;
                report.push({
                    season: r.season, round: r.round, race: r.race, session: "Race",
                    openf1SessionKey: null, lapRecords: 0, stintRecords: 0, pitRecords: 0,
                    hasSectorData: false, hasTyreData: false, status: "no_session_match",
                    notes: jolpicaDate ? `no OpenF1 session found for date ${jolpicaDate}` : "no Jolpica race date found",
                });
                console.log(`[OpenF1 Sweep]   round ${r.round} (${r.race}): no_session_match`);
                continue;
            }

            matched += 1;
            const { laps, stints, pit } = await fetchSessionData(session.session_key);
            const sectorData = hasSectorData(laps);
            const tyreData = hasTyreData(stints);
            const status = classifyCoverage({ lapCount: laps.length, stintCount: stints.length, pitCount: pit.length, sectorData, tyreData });

            const notes = [];
            if (laps.length === 0) notes.push("no lap records");
            if (stints.length === 0) notes.push("no stint records");
            if (pit.length === 0) notes.push("no pit-stop records");
            if (laps.length > 0 && !sectorData) notes.push("laps present but no sector times");
            if (stints.length > 0 && !tyreData) notes.push("stints present but no compound field");

            report.push({
                season: r.season, round: r.round, race: r.race, session: "Race",
                openf1SessionKey: session.session_key,
                lapRecords: laps.length, stintRecords: stints.length, pitRecords: pit.length,
                hasSectorData: sectorData, hasTyreData: tyreData, status,
                notes: notes.length ? notes.join("; ") : "ok",
            });
            console.log(`[OpenF1 Sweep]   round ${r.round} (${r.race}): ${status} — laps=${laps.length} stints=${stints.length} pit=${pit.length} sectors=${sectorData} tyres=${tyreData}`);

            await sleep(SESSION_PAUSE_MS);
        }
    }

    const summary = {
        totalRaces: ourRaces.length,
        matchedSessions: matched,
        unmatchedSessions: unmatched,
        byStatus: report.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}),
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), summary, races: report }, null, 2));

    console.log("\n" + "=".repeat(70));
    console.log("[OpenF1 Sweep] SUMMARY");
    console.log("=".repeat(70));
    console.log(summary);
    console.log(`\n[OpenF1 Sweep] Full report written to ${REPORT_PATH}`);
}

main().catch((error) => {
    console.error("[OpenF1 Sweep] FAILED:", error);
    process.exit(1);
});
