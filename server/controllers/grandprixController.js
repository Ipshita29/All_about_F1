const { cached, TTL } = require("../services/jolpicaCache");

const getGrandprix = async (req, res) => {
    const {year}=req.params;
    try {
        const data = await cached(`schedule:${year}`, TTL.SCHEDULE, async () => {
            const response = await fetch(`https://api.jolpi.ca/ergast/f1/${year}.json`)
            return response.json();
        });
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
        const data = await cached(`results:${year}:${round}`, TTL.HISTORICAL, async () => {
            const response = await fetch(`https://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`)
            return response.json();
        });
        res.json(
            data.MRData.RaceTable.Races[0].Results
        )
    }
    catch(error){
        res.status(500).json({
            message:"Failed to fetch race results"
        });
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

const getLatestRace = async (req, res) => {
    try {
        const data = await cached("latest", TTL.LATEST, async () => {
            const response = await fetch(
                "https://api.jolpi.ca/ergast/f1/current/last/results.json"
            );
            return response.json();
        });

        res.json(
            data.MRData.RaceTable.Races[0]
        );
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch latest race"
        });
    }
};
module.exports = {
    getGrandprix,getRaceResults,getQualifyingResults,getLatestRace,getPitStops
}
