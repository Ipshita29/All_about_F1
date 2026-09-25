const router = require("express").Router()
const {getUpcomingPrediction,getHistory,getEvaluation,getPerformance} = require("../controllers/predictorController")
router.get("/upcoming",getUpcomingPrediction)
router.get("/history",getHistory)
router.get("/performance",getPerformance)
router.get("/evaluation/:season/:round",getEvaluation)
module.exports=router;
