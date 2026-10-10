const { cached, TTL } = require("../services/jolpicaCache");
const liveRaceService = require("../services/liveRaceService");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonThrowing(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Jolpica request failed (${response.status}): ${url}`);
    return response.json();
}

/*
 * The ONE place that decides "does this round's race classification
 * genuinely exist yet" — throws when it doesn't (empty Races, or a
 * Race with no Results), rather than returning an empty/partial shape.
 * Used both by getRaceResults below AND getLatestRace's selected-race
 * logic, specifically so that whichever caller wraps this in cached()
 * never stores a "not posted yet" response as if it were final —
 * cached() only writes what its fetcher successfully RETURNS, so a
 * throw here means nothing gets cached and the next request tries
 * fresh instead of being stuck repeating a stale empty answer.
 */
async function fetchCompletedRaceResults(year, round) {
    const data = await fetchJsonThrowing(`https://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`);
    const race = data?.MRData?.RaceTable?.Races?.[0];
    if (!race || !Array.isArray(race.Results) || race.Results.length === 0) {
        throw new Error(`Race results not yet available for ${year} round ${round}`);
    }
    return race;
}

const getGrandprix = async (req, res) => {
    const {year}=req.params;
    try {
        const data = await cached(`schedule:${year}`, TTL.SCHEDULE, () => fetchJsonThrowing(`https://api.jolpi.ca/ergast/f1/${year}.json`));
        res.json(
            data.MRData.RaceTable.Races
        )
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch grand prix data" })
    }
}
const getRaceResults = async (req,res)=>{
    try{
        const {year,round} = req.params;
        const race = await cached(`results:${year}:${round}`, TTL.HISTORICAL, () => fetchCompletedRaceResults(year, round));
        res.json(race.Results)
    }
    catch(error){
        // Genuinely no results yet (not posted) vs. an actual upstream
        // failure both land here — either way, nothing was cached, so
        // the honest answer is "not available right now", not a crash.
        res.status(200).json([]);
    }
};
const getQualifyingResults = async (req, res) => {
    try {
        const { year, round } = req.params;

        const data = await cached(`qualifying:${year}:${round}`, TTL.HISTORICAL, async () => {
            const response = await fetch(
                `https://api.jolpi.ca/ergast/f1/${year}/${round}/qualifying.json`
            );
            return response.json();
        });

        res.json(
            data.MRData.RaceTable.Races[0]?.QualifyingResults || []
        );
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch qualifying results"
        });
    }
};

const getSprintResults = async (req, res) => {
    try {
        const { year, round } = req.params;
        const data = await cached(`sprint:${year}:${round}`, TTL.HISTORICAL, async () => {
            const response = await fetch(
                `https://api.jolpi.ca/ergast/f1/${year}/${round}/sprint.json`
            );
            return response.json();
        });
        res.json(
            data.MRData.RaceTable.Races[0]?.SprintResults || []
        );
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch sprint results"
        });
    }
};

const getPitStops = async (req, res) => {
    try {
        const { year, round } = req.params;
        const data = await cached(`pitstops:${year}:${round}`, TTL.HISTORICAL, async () => {
            const response = await fetch(
                `https://api.jolpi.ca/ergast/f1/${year}/${round}/pitstops.json?limit=100`
            );
            return response.json();
        });
        res.json(
            data.MRData.RaceTable.Races[0]?.PitStops || []
        );
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch pit stop data"
        });
    }
};

/*
 * "The most recently completed race" used to mean "whatever Jolpica's
 * own current/last/results.json says" — confirmed live that this lags
 * the real calendar: ~1h after Singapore's 2026-10-11 12:00Z race had
 * finished, current/last/results.json STILL returned the PREVIOUS
 * round (Bahrain), because Jolpica hadn't ingested Singapore's results
 * yet, even though 2026/17/results.json already existed as a round
 * with real qualifying data — the event itself was known, just not its
 * race classification yet. Relying on current/last meant the dashboard
 * kept showing Bahrain under a race that had already happened.
 *
 * Fixed by determining the selected race from the actual season
 * schedule + the real clock instead: the latest round whose own
 * scheduled race start is already in the past IS the selected race by
 * definition, regardless of whether Jolpica has posted its results
 * yet. Its results are then fetched separately (and only cached once
 * genuinely non-empty, via fetchCompletedRaceResults above) — if
 * they're not ready, `resultsPending: true` says so explicitly, naming
 * THAT race, rather than silently substituting an older one.
 */
async function determineSelectedRace(now) {
    const year = String(now.getUTCFullYear());
    const schedule = await cached(`schedule:${year}`, TTL.SCHEDULE, () => fetchJsonThrowing(`https://api.jolpi.ca/ergast/f1/${year}.json`));
    const races = schedule?.MRData?.RaceTable?.Races ?? [];

    const pastRaces = races.filter((r) => {
        const start = new Date(`${r.date}T${r.time || "00:00:00Z"}`);
        return !Number.isNaN(start.getTime()) && start <= now;
    });

    if (pastRaces.length === 0) return null;
    return pastRaces[pastRaces.length - 1]; // schedule is already chronological
}

const getLatestRace = async (req, res) => {
    try {
        const now = new Date();
        const selected = await determineSelectedRace(now);

        if (!selected) {
            return res.json({ available: false, reason: "no_completed_race_this_season" });
        }

        const { season, round, raceName, date, time, Circuit } = selected;

        let resultsRace = null;
        try {
            resultsRace = await cached(`results:${season}:${round}`, TTL.HISTORICAL, () => fetchCompletedRaceResults(season, round));
        } catch (resultsError) {
            // Genuinely not posted yet — logged for visibility, not
            // treated as a request failure (see dataStatus below).
            console.warn(`[grandprix] results not yet available for ${season} round ${round}: ${resultsError.message}`);
        }

        // Alternative source, investigated for exactly this "provider
        // hasn't posted yet" gap — see getRetainedSessionSummary's own
        // comment for why this only ever confirms the race genuinely
        // finished (real lap count) rather than reconstructing a
        // classification from it (that would mean guessing driver/
        // constructor IDs and points, not reporting real data).
        let liveConfirmation = null;
        if (!resultsRace) {
            try {
                const summary = liveRaceService.getRetainedSessionSummary(season, round);
                if (summary.matches) liveConfirmation = summary;
            } catch (liveError) {
                console.warn(`[grandprix] live-timing cross-check failed for ${season} round ${round}: ${liveError.message}`);
            }
        }

        res.json({
            available: true,
            resultsPending: !resultsRace,
            liveConfirmation,
            season,
            round,
            raceName,
            date,
            time,
            Circuit,
            Results: resultsRace?.Results ?? [],
        });
    } catch (error) {
        console.error(`[grandprix] getLatestRace failed: ${error.message}`);
        res.status(500).json({
            message: "Failed to determine the latest race"
        });
    }
};

/*
 * Full lap-by-lap position history for a completed race — the Live
 * Dashboard's post-race Team Position line chart. Jolpica's own
 * /laps.json caps each page at 100 Timing rows server-side regardless
 * of the `limit` requested (confirmed: limit=2000 still only returned
 * 100 rows), so a ~55-lap, 20-driver race (~1100 rows) needs roughly a
 * dozen paginated requests. Each page's lap boundaries can overlap the
 * next (offset is measured in rows, not whole laps), so results are
 * deduped into a Map<lap, Map<driverId, position>> keyed by (lap,
 * driver) rather than appended — overlap produces redundant writes to
 * the same key, never a duplicate entry. Throttled between pages (same
 * reasoning as teamController.getConstructorPodiums: unthrottled
 * requests here trip Jolpica's documented 3 req/s limit).
 *
 * A dozen sequential requests is also a dozen chances for one transient
 * blip — confirmed this was the real "lap history cannot be retrieved"
 * bug, not a genuine data gap: any single page failing used to silently
 * `break` and return whatever partial data had been gathered so far,
 * which getRaceLaps then happily cached for 24h as if it were the
 * complete, correct answer — one bad request away from permanently
 * showing an incomplete or empty chart for that race. Each page now
 * gets a couple of retries, and if a page still fails after that, this
 * THROWS instead of returning a partial result, so getRaceLaps' cached()
 * call never stores a broken answer — the next request tries fresh.
 */
async function fetchLapsPage(base, offset) {
    const attempts = 3;
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            const response = await fetch(`${base}?limit=100&offset=${offset}`);
            if (!response.ok) throw new Error(`Jolpica laps request failed (${response.status})`);
            return await response.json();
        } catch (error) {
            lastError = error;
            if (i < attempts - 1) await sleep(500);
        }
    }
    throw lastError;
}

async function fetchAllLaps(year, round) {
    const base = `https://api.jolpi.ca/ergast/f1/${year}/${round}/laps.json`;
    let offset = 0;
    let total = Infinity;
    const byLap = new Map();
    let firstPage = true;

    while (offset < total) {
        const data = await fetchLapsPage(base, offset);
        total = Number(data.MRData.total) || 0;
        const race = data.MRData.RaceTable.Races[0];

        // total === 0 on the very first page is indistinguishable from
        // "this round's laps just haven't been posted yet" (confirmed:
        // this is exactly what 2026 round 17 returns the moment after
        // its own race finishes) — every race this app covers (2020+)
        // genuinely has lap data once it's posted, so rather than cache
        // an empty [] as if that were the final answer, this throws —
        // same "don't cache a not-ready response" rule fetchLapsPage's
        // retries already apply to a hard failure.
        if (firstPage && total === 0) {
            throw new Error(`No lap data posted yet for ${year} round ${round}`);
        }
        firstPage = false;
        if (!race) break;

        let rowsThisPage = 0;
        for (const lap of race.Laps || []) {
            const num = Number(lap.number);
            if (!byLap.has(num)) byLap.set(num, new Map());
            const bucket = byLap.get(num);
            for (const t of lap.Timings || []) {
                bucket.set(t.driverId, Number(t.position));
                rowsThisPage += 1;
            }
        }
        if (rowsThisPage === 0) break;
        offset += rowsThisPage;
        if (offset < total) await sleep(350);
    }

    return Array.from(byLap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([lap, driverMap]) => ({ lap, positions: Object.fromEntries(driverMap) }));
}

const getRaceLaps = async (req, res) => {
    const { year, round } = req.params;
    try {
        const laps = await cached(`laps:${year}:${round}`, TTL.HISTORICAL, () => fetchAllLaps(year, round));
        res.json(laps);
    } catch (error) {
        console.warn(`[grandprix] lap data unavailable for ${year} round ${round}: ${error.message}`);
        res.status(200).json([]);
    }
};

module.exports = {
    getGrandprix,getRaceResults,getQualifyingResults,getSprintResults,getLatestRace,getPitStops,getRaceLaps
}
