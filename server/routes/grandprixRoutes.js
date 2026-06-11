const router = require("express").Router()
const {getGrandprix,getRaceResults,getQualifyingResults} = require("../controllers/grandprixController")
router.get("/qualifying/:year/:round",getQualifyingResults)
router.get("/results/:year/:round",getRaceResults);
router.get("/:year",getGrandprix)

module.exports=router;