const router = require("express").Router()
const {getCircuit} = require("../controllers/circuitController")
router.get("/",getCircuit)
module.exports=router;