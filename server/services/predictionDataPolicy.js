/*
 * ═══════════════════════════════════════════════════════════════════
 * PREDICTION DATA POLICY (Phase 1 of the accuracy-improvement plan)
 * ═══════════════════════════════════════════════════════════════════
 *
 * The single source of truth for WHAT INFORMATION THE PREDICTOR IS
 * ALLOWED TO USE at each prediction point. This file makes an already
 * real distinction (predictorService.js has always had a "stage")
 * explicit and enforced, instead of implicit in a handful of
 * conditional fetches scattered across the engine.
 *
 * This is a DEFINITION + GUARD layer only. It does not compute
 * features, does not change weights, and does not fetch anything
 * itself — see predictorService.js for that. Nothing in this file may
 * be used to add a new scored feature; several allowed categories
 * below are explicitly marked "not yet scored" and must stay that way
 * until a later phase does that work on purpose.
 *
 * STAGES
 *   PRE_QUALIFYING  — everything knowable about a race before its
 *                      qualifying session has happened.
 *   POST_QUALIFYING — PRE_QUALIFYING plus that race's own real
 *                      qualifying result (grid position), which
 *                      genuinely exists by this point and is therefore
 *                      not leakage.
 *
 * WHAT MUST NEVER ENTER EITHER STAGE
 * The result of the race being predicted, or any race after it. Every
 * category below is either (a) a standing/history that by construction
 * only reflects races strictly before the one being predicted, or (b)
 * that race's own pre-race session data (qualifying, sprint) — never
 * its finishing order.
 */

const STAGES = Object.freeze({
    PRE_QUALIFYING: "pre_qualifying",
    POST_QUALIFYING: "post_qualifying",
});

// "scored"          — already feeds a computed feature in predictorService.js.
// "available"       — the raw data exists (fetched or derivable from an
//                      existing fetch) but is not yet turned into its own
//                      scored feature. Listed here so the ALLOWED set is
//                      honest about what's collected vs. what's used —
//                      wiring these in is later-phase work, not Phase 1.
const DATA_CATEGORIES = Object.freeze([
    {
        key: "raceIdentity",
        label: "Season / race",
        stage: STAGES.PRE_QUALIFYING,
        status: "scored",
        source: "predictorService.fetchUpcomingRace",
    },
    {
        key: "championshipStandings",
        label: "Championship standings",
        stage: STAGES.PRE_QUALIFYING,
        status: "scored",
        source: "predictorService.fetchStandings → computeChampionshipFeature",
    },
    {
        key: "recentForm",
        label: "Recent race results / form",
        stage: STAGES.PRE_QUALIFYING,
        status: "scored",
        source: "predictorService.fetchRecentResults → computeRecentFormFeature",
    },
    {
        key: "constructorPerformance",
        label: "Constructor performance",
        stage: STAGES.PRE_QUALIFYING,
        status: "scored",
        source: "predictorService.fetchStandings → computeConstructorFeature",
    },
    {
        key: "driverVsTeammate",
        label: "Driver vs teammate performance",
        stage: STAGES.PRE_QUALIFYING,
        status: "available",
        source: "predictorService assemblePrediction's teamRoster lookup (currently only used inside the post-qualifying teammate-delta bonus, not as a standalone pre-qualifying feature)",
    },
    {
        key: "circuitHistory",
        label: "Circuit history / type",
        stage: STAGES.PRE_QUALIFYING,
        status: "scored",
        source: "predictorService.fetchCircuitHistory → computeCircuitHistoryFeature",
    },
    {
        key: "weather",
        label: "Weather available before the race",
        stage: STAGES.PRE_QUALIFYING,
        // "available", not "scored" — status here specifically tracks the
        // LIVE predictor (predictorService.js), which still does not
        // consume weather; Phase 3.5 integrated real historical weather
        // into the Phase 2 dataset / Phase 3 ML feature vector only (see
        // weatherService.getHistoricalWeather and
        // backtestDatasetService.computeWeatherFeature), a separate
        // pipeline from the live model this status field describes.
        status: "available",
        source: "weatherService.getHistoricalWeather (Open-Meteo archive/reanalysis, confirmed to support past F1 race dates) — scored into the Phase 2/3 dataset only; the live upcoming-race forecast (weatherService.getForecast) still is not passed into predictorService or scored there",
    },
    {
        key: "reliability",
        label: "Reliability / DNF history",
        stage: STAGES.PRE_QUALIFYING,
        status: "available",
        source: "derivable from predictorService.fetchRecentResults' Result.status field (not currently isolated into its own feature)",
    },
    {
        key: "sprintWeekend",
        label: "Sprint-weekend information",
        stage: STAGES.PRE_QUALIFYING,
        status: "scored",
        source: "predictorService.fetchSprintResults → folded into computeRecentFormFeature once the sprint has run",
    },
    {
        key: "qualifyingPosition",
        label: "Qualifying position / grid position",
        stage: STAGES.POST_QUALIFYING,
        status: "scored",
        source: "predictorService.fetchQualifying → computeQualifyingFeature",
    },
    {
        key: "qualifyingGap",
        label: "Qualifying performance / gap if available",
        stage: STAGES.POST_QUALIFYING,
        status: "available",
        source: "Jolpica qualifying.json Q1/Q2/Q3 times (fetched but only .position is scored today, not the time gap)",
    },
]);

// Returns the categories allowed AT this stage — POST_QUALIFYING inherits
// everything PRE_QUALIFYING allows, plus its own two qualifying-only rows.
function getAllowedCategories(stage) {
    if (stage === STAGES.PRE_QUALIFYING) {
        return DATA_CATEGORIES.filter((c) => c.stage === STAGES.PRE_QUALIFYING);
    }
    return DATA_CATEGORIES;
}

/*
 * The enforcement half of this file. Every prediction — live or
 * backtest — funnels through predictorService.js's assemblePrediction,
 * and this is the one function it calls before touching any of these
 * fields. For PRE_QUALIFYING, qualifying results are stripped even if
 * a caller mistakenly passed real ones in, so "no qualifying data
 * before qualifying" is a structural guarantee of this module rather
 * than an incidental side effect of which fetches happen to run.
 * Sprint results are allowed at both stages (see sprintWeekend above),
 * so they pass through unchanged either way.
 */
function sanitizeStageInputs(stage, { qualifyingResults, sprintResults }) {
    if (stage === STAGES.PRE_QUALIFYING) {
        return { qualifyingResults: [], sprintResults: sprintResults || [] };
    }
    return { qualifyingResults: qualifyingResults || [], sprintResults: sprintResults || [] };
}

module.exports = { STAGES, DATA_CATEGORIES, getAllowedCategories, sanitizeStageInputs };
