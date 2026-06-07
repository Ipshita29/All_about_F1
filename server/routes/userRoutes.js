const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const {savePreferences} = require("../controllers/userController");

router.put(
    "/preferences",
    authMiddleware,
    savePreferences
);

module.exports = router;