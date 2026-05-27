const getDrivers=async(req,res)=>{
    try{
        const response = await fetch("https://api.jolpi.ca/ergast/f1/2026/drivers.json")
        const data = await response.json()
        res.json(
            data.MRData.DriverTable.Drivers
        )
    }
    catch(error){
        res.status(500).json({message:"Failed to fetch drivers data"})
    }
}
module.exports={
    getDrivers
}