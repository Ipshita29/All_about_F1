const { getLiveRaceStatus } = require("../services/liveRaceService");

const getLiveRace = async (req, res) => {
    try {
        const data = await getLiveRaceStatus();
        res.json(data);
    } catch (error) {
        res.status(502).json({ message: "Failed to fetch live race data" });
    }
};

module.exports = { getLiveRace };
