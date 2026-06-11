const getDrivers=async(req,res)=>{
    const { year } = req.params;
    try{
        const response = await fetch(`https://api.jolpi.ca/ergast/f1/${year}/drivers.json?limit=100`)
        const data = await response.json()
        res.json(
            data.MRData.DriverTable.Drivers
        )
    }
    catch(error){
        res.status(500).json({message:"Failed to fetch drivers data"})
    }
}

const getDriverStandings = async(req,res)=>{
    const { year } = req.params;
    try{
        const response = await fetch(`https://api.jolpi.ca/ergast/f1/${year}/driverstandings.json`)
        const data = await response.json();
        res.json(
            data.MRData.StandingsTable.StandingsLists[0].DriverStandings
        )
    }
    catch(error){
        res.status(500).json({
            message:"Failed to fetch standings"
        })
    }
}
module.exports={
    getDrivers,getDriverStandings 
}