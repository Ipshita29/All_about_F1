const router = require("express").Router()
const {getTeams} = require("../controllers/teamController")
router.get("/",getTeams)
module.exports=router;