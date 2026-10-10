const router = require("express").Router();
const { getWeatherForecast, getRaceWeatherConditions } = require("../controllers/weatherController");

router.get("/forecast", getWeatherForecast);
router.get("/race", getRaceWeatherConditions);

module.exports = router;
