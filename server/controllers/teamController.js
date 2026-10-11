const { getJson } = require("../services/jolpicaClient");
const { cached, TTL } = require("../services/jolpicaCache");

const getTeams = async (req, res) => {
    const { year } = req.params;
    try {
        const response = await fetch(`https://api.jolpi.ca/ergast/f1/${year}/constructors.json`)
        const data = await response.json();
        res.json(data.MRData.ConstructorTable.Constructors)
    }
    catch (error) {
        res.status(500).json({message: "Failed to fetch teams data"})}

}
const getConstructorStandings = async(req,res)=>{
    const { year } = req.params;
    try{
        const response = await fetch(
            `https://api.jolpi.ca/ergast/f1/${year}/constructorstandings.json`
        )
        const data = await response.json();
        res.json(data.MRData.StandingsTable.StandingsLists[0].ConstructorStandings)
    }
    catch(error){
        res.status(500).json({
            message:"Failed to fetch constructor standings"
        })
    }

}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
 * Career podium count per constructor — Compare Teams used to show this
 * as a hardcoded "—" because the constructor standings/constructors
 * endpoints never carried a podiums field (confirmed: Jolpica's
 * constructorstandings.json only has position/points/wins). It turns out
 * Jolpica DOES expose this, just under a different endpoint shape:
 * /constructors/{id}/results/{position}.json returns every race that
 * constructor finished in that exact position, and its MRData.total is
 * an exact count — no need to fetch/page through the actual race list.
 * Podiums = total(P1) + total(P2) + total(P3). Real, derived data, never
 * a guessed number.
 *
 * Each constructor needs 3 of these calls, and a full grid is ~12
 * constructors — 36 calls on a cold cache, comfortably enough to trip
 * Jolpica's documented 3 req/s free-tier limit if fired all at once
 * (confirmed: an unthrottled Promise.all across even 7 constructors hit
 * a 429 immediately). Processed sequentially with a small gap between
 * each team instead. Cached per constructor (TTL.HISTORICAL) since an
 * all-time podium count only ever moves by a handful per season, so
 * this slow path only runs once per constructor per cache window.
 */
const getConstructorPodiums = async (req, res) => {
    const idsParam = req.query.ids;
    if (!idsParam) return res.json({});
    const ids = [...new Set(idsParam.split(",").map((s) => s.trim()).filter(Boolean))];

    try {
        const result = {};
        for (const id of ids) {
            result[id] = await cached(`team-podiums:${id}`, TTL.HISTORICAL, async () => {
                const positionTotal = async (position) => {
                    const data = await getJson(`/constructors/${id}/results/${position}.json?limit=1`);
                    return Number(data?.MRData?.total) || 0;
                };
                let total = 0;
                for (const position of [1, 2, 3]) {
                    total += await positionTotal(position);
                    await sleep(350);
                }
                return total;
            });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch constructor podium totals" });
    }
};

module.exports = {
    getTeams,getConstructorStandings,getConstructorPodiums
}