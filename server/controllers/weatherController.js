const { getForecast, getRaceWeather } = require("../services/weatherService");

const getWeatherForecast = async (req, res) => {
    const { lat, lon, time } = req.query;
    if (!lat || !lon || !time) {
        return res.status(400).json({ message: "lat, lon and time query params are required" });
    }

    try {
        const forecast = await getForecast(Number(lat), Number(lon), time);
        if (!forecast) {
            return res.json({ available: false });
        }
        res.json({ available: true, ...forecast });
    } catch (error) {
        res.status(502).json({ message: "Failed to fetch weather forecast" });
    }
};

// Historical race-time weather for a COMPLETED race — the Live
// Dashboard's post-race Weather panel. `start` is the race's actual
// start as an ISO string, `durationMs` the winner's real elapsed race
// time (Results[0].Time.millis) — both already known to the caller
// from the same race-results fetch, never guessed here.
const getRaceWeatherConditions = async (req, res) => {
    const { lat, lon, start, durationMs } = req.query;
    if (!lat || !lon || !start) {
        return res.status(400).json({ message: "lat, lon and start query params are required" });
    }

    try {
        const weather = await getRaceWeather(Number(lat), Number(lon), start, Number(durationMs));
        if (!weather) {
            return res.json({ available: false });
        }
        res.json({ available: true, ...weather });
    } catch (error) {
        res.status(502).json({ message: "Failed to fetch race weather" });
    }
};

module.exports = { getWeatherForecast, getRaceWeatherConditions };
