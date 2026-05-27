const router = require("express").Router()
const {getGrandprix} = require("../controllers/grandprixController")
router.get("/",getGrandprix)
module.exports=router;