const router = require("express").Router()
const {getTeams,getConstructorStandings,getConstructorPodiums} = require("../controllers/teamController")
router.get("/standings/:year",getConstructorStandings)
router.get("/podiums",getConstructorPodiums)
router.get("/:year",getTeams)

module.exports=router;