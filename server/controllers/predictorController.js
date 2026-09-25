const { buildPrediction } = require("../services/predictorService");
const { getPredictionHistory, getRaceEvaluation, getPerformanceSummary } = require("../services/evaluationService");

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
                reason: result.error,
                message: ERROR_MESSAGES[result.error] || "Prediction unavailable.",
            });
        }
        res.json({ available: true, ...result });
    } catch (error) {
        res.status(502).json({ available: false, reason: "upstream_failure", message: "Prediction unavailable — failed to reach F1 data source." });
    }
};

const getHistory = async (req, res) => {
    try {
        const result = await getPredictionHistory();
        res.json(result);
    } catch (error) {
        res.status(502).json({ races: [], message: "Could not load prediction history right now." });
    }
};

const getEvaluation = async (req, res) => {
    try {
        const { season, round } = req.params;
        const result = await getRaceEvaluation(season, round);
        res.json(result);
    } catch (error) {
        res.status(502).json({ eligible: false, reason: "upstream_failure" });
    }
};

const getPerformance = async (req, res) => {
    try {
        const result = await getPerformanceSummary();
        res.json(result);
    } catch (error) {
        res.status(502).json({ available: false, racesEvaluated: 0 });
    }
};

module.exports = { getUpcomingPrediction, getHistory, getEvaluation, getPerformance };
