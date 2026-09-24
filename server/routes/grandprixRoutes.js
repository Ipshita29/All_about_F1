const router = require("express").Router()
const {getGrandprix,getRaceResults,getQualifyingResults,getLatestRace,getPitStops} = require("../controllers/grandprixController")
router.get("/qualifying/:year/:round",getQualifyingResults)
router.get("/results/:year/:round",getRaceResults);
router.get("/pitstops/:year/:round",getPitStops);
router.get("/latest",getLatestRace);
router.get("/:year",getGrandprix)
module.exports=router;