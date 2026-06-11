const getGrandprix = async (req, res) => {
    const {year}=req.params;
    try {
        const response = await fetch(`https://api.jolpi.ca/ergast/f1/${year}.json`)
        const data = await response.json();
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
        const response = await fetch(`https://api.jolpi.ca/ergast/f1/${year}/${round}/results.json`)
        const data = await response.json();
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

        const response = await fetch(
            `https://api.jolpi.ca/ergast/f1/${year}/${round}/qualifying.json`
        );

        const data = await response.json();

        res.json(
            data.MRData.RaceTable.Races[0]?.QualifyingResults || []
        );
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch qualifying results"
        });
    }
};

const getLatestRace = async (req, res) => {
    try {
        const response = await fetch(
            "https://api.jolpi.ca/ergast/f1/current/last/results.json"
        );

        const data = await response.json();

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
    getGrandprix,getRaceResults,getQualifyingResults,getLatestRace
}