const { buildPrediction } = require("../services/predictorService");

const ERROR_MESSAGES = {
    no_upcoming_race: "No upcoming race found — nothing to predict right now.",
    insufficient_historical_data: "Prediction unavailable — insufficient historical data.",
};

const getUpcomingPrediction = async (req, res) => {
    try {
        const result = await buildPrediction();
        if (result.error) {
            return res.status(200).json({
                available: false,
                message: ERROR_MESSAGES[result.error] || "Prediction unavailable.",
            });
        }
        res.json({ available: true, ...result });
    } catch (error) {
        res.status(502).json({ available: false, message: "Prediction unavailable — failed to reach F1 data source." });
    }
};

module.exports = { getUpcomingPrediction };
