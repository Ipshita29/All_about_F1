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

module.exports = {
    getGrandprix
}