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

module.exports = { getJson };
