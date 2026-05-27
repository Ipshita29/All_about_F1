const getTeams = async (req, res) => {
    try {
        const response = await fetch("https://api.jolpi.ca/ergast/f1/2026/constructors.json")
        const data = await response.json();
        res.json(
            data.MRData.ConstructorTable.Constructors
        )
    }
    catch (error) {
        res.status(500).json({message: "Failed to fetch teams data"})}

}

module.exports = {
    getTeams
}