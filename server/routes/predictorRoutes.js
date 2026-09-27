const router = require("express").Router()
const {getUpcomingPrediction,getHistory,getRaceDetail,getPerformance} = require("../controllers/predictorController")
router.get("/upcoming",getUpcomingPrediction)
router.get("/history",getHistory)
router.get("/performance",getPerformance)
router.get("/race/:season/:round",getRaceDetail)
module.exports=router;
