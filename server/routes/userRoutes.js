const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const {updateProfile,getProfile} = require("../controllers/userController");

router.put("/preferences",authMiddleware,updateProfile)
router.put("/profile",authMiddleware,updateProfile)
router.get("/profile",authMiddleware,getProfile)
module.exports = router;