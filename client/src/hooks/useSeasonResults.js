import { useEffect, useState } from "react";

const API = "http://localhost:3000";

const EMPTY = { year: null, races: [], resultsByRound: {}, qualifyingByRound: {}, error: false };

/*
 * Fetches every completed round's race results (and, optionally,
 * qualifying classification) for a season — the same
 * /grandprixdashboard/results & /qualifying endpoints GrandPrix.jsx already
 * calls per round, just gathered up front so a comparison page can compute
 * round-by-round and season-aggregate stats for two entities at a time.
 *
 * `loading`/`error` and the data itself are all derived from comparing the
 * requested `year` against the year the last resolved fetch was for —
 * round numbers repeat across seasons, so this also guarantees a stale
 * previous year's results can never render under a newly selected year
 * while the new fetch is still in flight.
 *
 * Only runs while `enabled` (comparison pages pass this in once two
 * drivers/teams are actually selected, so nothing is fetched on an empty
 * page).
 */
export default function useSeasonResults(year, { includeQualifying = false, enabled = true } = {}) {
    const [state, setState] = useState(EMPTY);

    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;

        fetch(`${API}/grandprixdashboard/${year}`)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error("season fetch failed"))))
            .then((raceList) => {
                if (cancelled) return null;
                const list = Array.isArray(raceList) ? raceList : [];
                const now = new Date();
                const completed = list.filter((r) => {
                    const d = r.time ? new Date(`${r.date}T${r.time}`) : new Date(`${r.date}T00:00:00`);
                    return d < now;
                });

                return Promise.all(
                    completed.map((race) =>
                        Promise.all([
                            fetch(`${API}/grandprixdashboard/results/${year}/${race.round}`)
                                .then((res) => (res.ok ? res.json() : []))
                                .catch(() => []),
                            includeQualifying
                                ? fetch(`${API}/grandprixdashboard/qualifying/${year}/${race.round}`)
                                    .then((res) => (res.ok ? res.json() : []))
                                    .catch(() => [])
                                : Promise.resolve(null),
                        ]).then(([results, qualifying]) => ({ round: race.round, results, qualifying }))
                    )
                ).then((all) => {
                    if (cancelled) return;
                    const resultsByRound = {};
                    const qualifyingByRound = {};
                    all.forEach(({ round, results, qualifying }) => {
                        resultsByRound[round] = Array.isArray(results) ? results : [];
                        if (qualifying !== null) qualifyingByRound[round] = Array.isArray(qualifying) ? qualifying : [];
                    });
                    setState({ year, races: list, resultsByRound, qualifyingByRound, error: false });
                });
            })
            .catch(() => {
                if (cancelled) return;
                setState({ year, races: [], resultsByRound: {}, qualifyingByRound: {}, error: true });
            });

        return () => { cancelled = true; };
    }, [year, includeQualifying, enabled]);

    const current = state.year === year ? state : EMPTY;

    return {
        races: current.races,
        resultsByRound: current.resultsByRound,
        qualifyingByRound: current.qualifyingByRound,
        loading: enabled && state.year !== year,
        error: current.error,
    };
}
