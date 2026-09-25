/*
 * Tiny in-memory cache for the existing per-controller Jolpica fetches
 * (results, qualifying, pit stops, season schedules). These endpoints had
 * zero caching — every Race Hub page load fires ~8-12 Jolpica requests in
 * parallel (schedule, latest, standings x2, qualifying, pit stops, up to
 * 5 recent-round results), which is enough to trip Jolpica's free-tier
 * rate limit (documented at 3 req/s) under real use, especially across a
 * few page reloads in a short session. That's the actual, confirmed root
 * cause of "Strategy data unavailable" intermittently appearing even
 * though the pit-stop data genuinely exists — the request never reaches
 * Jolpica successfully, and the failure is swallowed into an empty
 * fallback.
 *
 * Historical race data (a specific past round's results/qualifying/pit
 * stops) never changes once posted, so it's cached for a long time;
 * season schedules and "latest race" change occasionally, so they get a
 * shorter TTL. This is deliberately simple — a single Map, no eviction
 * policy beyond TTL — matching the same pattern already used in
 * predictorService.js rather than introducing a new caching library.
 */

const store = new Map();

async function cached(key, ttlMs, fetcher) {
    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.expiresAt > now) return hit.value;

    const value = await fetcher();
    store.set(key, { value, expiresAt: now + ttlMs });
    return value;
}

const TTL = {
    HISTORICAL: 24 * 60 * 60 * 1000, // a past round's results/qualifying/pitstops never change
    SCHEDULE: 10 * 60 * 1000, // a season's schedule rarely changes within a session
    LATEST: 2 * 60 * 1000, // "current/last" can advance to a new race
};

module.exports = { cached, TTL };
