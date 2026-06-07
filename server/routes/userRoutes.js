const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const {savePreferences,getProfile} = require("../controllers/userController");

router.put("/preferences",authMiddleware,savePreferences)
router.get("/profile",authMiddleware,getProfile)
module.exports = router;