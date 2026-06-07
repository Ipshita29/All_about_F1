const router = require("express").Router()
const {getDrivers,getDriverStandings} = require("../controllers/driverController")
router.get("/standings/:year", getDriverStandings)
router.get("/:year",getDrivers)

module.exports=router;