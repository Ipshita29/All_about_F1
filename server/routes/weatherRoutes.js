const router = require("express").Router();
const { getWeatherForecast } = require("../controllers/weatherController");

router.get("/forecast", getWeatherForecast);

module.exports = router;
