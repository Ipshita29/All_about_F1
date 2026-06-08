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

module.exports = {
    getTeams,getConstructorStandings
}