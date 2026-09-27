const router = require("express").Router()
const {getGrandprix,getRaceResults,getQualifyingResults,getSprintResults,getLatestRace,getPitStops} = require("../controllers/grandprixController")
router.get("/qualifying/:year/:round",getQualifyingResults)
router.get("/sprint/:year/:round",getSprintResults)
router.get("/results/:year/:round",getRaceResults);
router.get("/pitstops/:year/:round",getPitStops);
router.get("/latest",getLatestRace);
router.get("/:year",getGrandprix)
module.exports=router;