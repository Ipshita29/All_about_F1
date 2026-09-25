const { getForecast } = require("../services/weatherService");

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

module.exports = { getWeatherForecast };
