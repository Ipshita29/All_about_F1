const router = require("express").Router()
const {getDrivers} = require("../controllers/driverController")
router.get("/",getDrivers)
module.exports=router;