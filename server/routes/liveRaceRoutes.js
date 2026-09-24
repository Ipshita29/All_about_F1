const router = require("express").Router()
const {getLiveRace} = require("../controllers/liveRaceController")
router.get("/race",getLiveRace)
module.exports=router;
