const router = require("express").Router()
const {getTeams,getConstructorStandings} = require("../controllers/teamController")
router.get("/standings/:year",getConstructorStandings)
router.get("/:year",getTeams)

module.exports=router;