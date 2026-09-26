/*
 * Minimal shared Jolpica/Ergast fetch helper, used only by the predictor
 * (services/predictorService.js). The existing controllers (grandprix,
 * driver, team, circuit) each already do their own inline fetch — this
 * file doesn't touch or replace those; it exists so the *new* Phase 12
 * code doesn't grow a second copy of "build a Jolpica URL and unwrap
 * MRData" across half a dozen predictor functions.
 */

const BASE = "https://api.jolpi.ca/ergast/f1";

async function getJson(path) {
    const response = await fetch(`${BASE}${path}`);
    if (!response.ok) {
        throw new Error(`Jolpica request failed (${response.status}): ${path}`);
    }
    return response.json();
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
 * For the handful of REQUIRED predictor calls (the upcoming race, current
 * standings) that have no safe fallback if they fail — everything else in
 * predictorService.js is wrapped in its own try/catch and degrades to an
 * "unavailable" feature instead of failing the whole prediction. A single
 * quick retry absorbs the odd transient blip (Jolpica's free tier is
 * documented at 3 req/s) without turning into a retry storm.
 */
async function getJsonRetry(path, attempts = 2, delayMs = 400) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            return await getJson(path);
        } catch (error) {
            lastError = error;
            if (i < attempts - 1) await sleep(delayMs);
        }
    }
    throw lastError;
}

module.exports = { getJson, getJsonRetry };
