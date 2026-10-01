/*
 * Minimal shared OpenF1 fetch helper — mirrors jolpicaClient.js's own
 * shape exactly (same getJson/getJsonRetry pattern, same no-dependency
 * use of Node's built-in fetch) so this doesn't grow a second, different
 * HTTP-client style into the project. OpenF1 (api.openf1.org) is free and
 * keyless, with historical coverage confirmed (Phase 6) from 2023 onward.
 *
 * This file does ONE thing: build a URL and unwrap the response. It does
 * not decide what counts as "coverage" or cache anything — that's
 * ml/openf1_coverage_sweep.js's job (an offline investigation script, not
 * part of the live app), exactly the same separation jolpicaClient.js has
 * from backtestDatasetService.js.
 */

const BASE = "https://api.openf1.org/v1";

async function getJson(path) {
    const response = await fetch(`${BASE}${path}`);
    if (!response.ok) {
        throw new Error(`OpenF1 request failed (${response.status}): ${path}`);
    }
    return response.json();
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Same reasoning as jolpicaClient.getJsonRetry: a single retry absorbs a
// transient blip without turning into a retry storm against OpenF1's
// fair-use free tier.
async function getJsonRetry(path, attempts = 2, delayMs = 800) {
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
