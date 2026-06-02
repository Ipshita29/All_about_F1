const router = require("express").Router()
const {getGrandprix} = require("../controllers/grandprixController")
router.get("/:year",getGrandprix)
module.exports=router;