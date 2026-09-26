const mongoose = require("mongoose");

/*
 * A stored snapshot of a Phase 12 prediction for one race + stage. This is
 * what Phase 14 evaluation reads back later, once that race is complete —
 * never a regenerated prediction. `source` distinguishes:
 *   "live"     — persisted at the moment predictorService actually
 *                generated it for what was then the upcoming race.
 *   "backtest" — reconstructed after the fact for a race that predates
 *                this phase, using the exact same feature pipeline but
 *                scoped strictly to data available before that race
 *                (standings as of the previous round, recent form from
 *                earlier rounds only, that race's own real qualifying
 *                result). See services/predictorService.js
 *                buildBacktestPrediction() for the leakage-safety
 *                reasoning — clearly labeled, never presented as if it
 *                were captured in real time.
 */

const driverPredictionSchema = new mongoose.Schema(
    {
        driverId: String,
        driverName: String,
        driverCode: String,
        constructorId: String,
        constructor: String,
        predictedPosition: Number,
        expectedFinish: Number,
        winProbability: Number,
        podiumProbability: Number,
        top5Probability: Number,
        top10Probability: Number,
        confidence: String,
        // Per-factor breakdown behind "Why This Prediction?" — without this
        // a prediction served back from storage (rather than freshly
        // generated) would have nothing to show there.
        factors: mongoose.Schema.Types.Mixed,
    },
    { _id: false }
);

const racePredictionSchema = new mongoose.Schema(
    {
        season: { type: String, required: true },
        round: { type: Number, required: true },
        raceName: String,
        circuit: String,
        circuitId: String,
        raceDate: String,
        // The rest of the race identity the API response carries — stored
        // too so a served-from-storage prediction round-trips losslessly
        // through the frontend instead of losing its header details.
        country: String,
        qualifyingDate: String,
        sprintDate: String,
        hasSprint: Boolean,
        stage: { type: String, enum: ["pre_qualifying", "post_qualifying"], required: true },
        source: { type: String, enum: ["live", "backtest"], default: "live" },
        modelName: String,
        modelVersion: String,
        weights: mongoose.Schema.Types.Mixed,
        dataAvailability: mongoose.Schema.Types.Mixed,
        weather: mongoose.Schema.Types.Mixed,
        limitations: [String],
        generatedAt: { type: Date, required: true },
        predictions: [driverPredictionSchema],
    },
    { timestamps: true }
);

// One stored prediction per race+stage — a later stage (post-qualifying)
// is a distinct document, not an overwrite of the pre-qualifying one, so
// both remain individually evaluable/inspectable.
racePredictionSchema.index({ season: 1, round: 1, stage: 1 }, { unique: true });

module.exports = mongoose.model("RacePrediction", racePredictionSchema);
