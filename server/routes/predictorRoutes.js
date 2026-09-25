const router = require("express").Router()
const {getUpcomingPrediction} = require("../controllers/predictorController")
router.get("/upcoming",getUpcomingPrediction)
module.exports=router;
