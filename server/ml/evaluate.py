#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 4 — OFFLINE ML EVALUATION PIPELINE
═══════════════════════════════════════════════════════════════════

Reads the dataset export_dataset.js produced (Phase 2/3/3.5's feature
engineering, unmodified — this script trains and evaluates only, it
never computes a feature itself) and compares, per prediction stage:

  1. Grid-position baseline      (POST_QUALIFYING only — no leakage)
  2. Championship-position baseline (both stages)
  3. Existing hand-weighted predictor (real predictorService.js output,
     captured by export_dataset.js via buildBacktestPrediction — TEST
     split / POST_QUALIFYING only, since that function always predicts
     post-qualifying)
  4. Logistic Regression  (binary "will this driver win", ranked by
     P(win) within each race to derive a finishing-order prediction)
  5. Random Forest        (regression on finishPosition)
  6. Gradient Boosting     (regression on finishPosition, sklearn's
     built-in GradientBoostingRegressor — the `xgboost` package itself
     is not installed in this environment, so true XGBoost is skipped
     per the phase's own "only if already supported" condition)

Every model/baseline is graded with the EXACT SAME metric functions,
ported line-for-line from evaluationService.js's matchAndEvaluate() /
hitRate() — winnerCorrect, podiumHitRate, top5HitRate, top10HitRate,
meanPositionError — so "compare against the existing predictor" is an
apples-to-apples comparison, not two different scoring rules.

SPLITS: chronological, season-level, exactly as exported (train=2023-24,
validation=2025, test=2026) — never re-shuffled here. Training rows are
restricted to classified/classified-retired outcomes (a real
finishPosition target); imputation medians are computed from TRAIN ONLY
and applied unchanged to validation/test (no leakage from val/test
statistics into the model).

Nothing here writes back into the Node app, trains anything used by
predictorService.js, or changes production behavior. Run standalone:
    python3 ml/evaluate.py
"""

import json
from pathlib import Path
from collections import defaultdict

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
DATASET_PATH = ARTIFACT_DIR / "dataset.json"
RESULTS_PATH = ARTIFACT_DIR / "results.json"

SCORABLE_STATUSES = {"classified", "classified_retired"}
FEATURE_PREFIX = "f_"
STAGES = ["pre_qualifying", "post_qualifying"]
SPLITS = ["train", "validation", "test"]

RANDOM_STATE = 42


# ---------------------------------------------------------------------------
# Loading / flattening
# ---------------------------------------------------------------------------

def load_dataset():
    with open(DATASET_PATH) as f:
        return json.load(f)


def flatten_samples(samples):
    rows = []
    for s in samples:
        row = {
            "season": s["season"],
            "round": int(s["round"]),
            "race": s["race"],
            "driverId": s["driverId"],
            "stage": s["stage"],
            "split": s["split"],
            "outcome_finishPosition": s["outcome"]["finishPosition"],
            "outcome_classification": s["outcome"]["classification"],
        }
        for k, v in s["mlFeatures"].items():
            row[f"{FEATURE_PREFIX}{k}"] = v
        rows.append(row)
    return pd.DataFrame(rows)


def feature_columns_for(df_train_stage):
    cols = [c for c in df_train_stage.columns if c.startswith(FEATURE_PREFIX)]
    # Drop columns entirely null in THIS STAGE's train split — this is how
    # PRE_QUALIFYING naturally loses every qualifying-derived column
    # without hardcoding a list: they're null for every pre-qualifying
    # sample by Phase 1/3's own gate, so they carry zero training signal
    # and pandas/sklearn would otherwise be handed an all-NaN column.
    return [c for c in cols if df_train_stage[c].notna().any()]


# ---------------------------------------------------------------------------
# Metrics — ported from evaluationService.js's matchAndEvaluate/hitRate
# ---------------------------------------------------------------------------

def is_scorable(classification):
    return classification in SCORABLE_STATUSES


def evaluate_race_group(rows):
    """rows: list of dicts with driverId, predictedPosition,
    outcome_finishPosition, outcome_classification."""
    evals = []
    for r in rows:
        scorable = is_scorable(r["outcome_classification"])
        actual_pos = r["outcome_finishPosition"] if scorable else None
        pos_error = abs(r["predictedPosition"] - actual_pos) if scorable and actual_pos is not None else None
        evals.append({
            "driverId": r["driverId"],
            "predictedPosition": r["predictedPosition"],
            "actualPosition": actual_pos,
            "status": r["outcome_classification"],
            "positionError": pos_error,
        })

    scorable_evals = [e for e in evals if e["positionError"] is not None]
    mean_position_error = float(np.mean([e["positionError"] for e in scorable_evals])) if scorable_evals else None

    predicted_winner = next((e for e in evals if e["predictedPosition"] == 1), None)
    winner_correct = bool(predicted_winner and predicted_winner["status"] == "classified" and predicted_winner["actualPosition"] == 1)

    actual_classified_sorted = sorted(
        [e for e in evals if is_scorable(e["status"])], key=lambda e: e["actualPosition"]
    )

    def hit_rate(n):
        predicted_set = {e["driverId"] for e in evals if e["predictedPosition"] <= n}
        actual_top_n = [e["driverId"] for e in actual_classified_sorted[:n]]
        if not actual_top_n:
            return None
        hits = sum(1 for d in actual_top_n if d in predicted_set)
        return hits / len(actual_top_n)

    return {
        "winnerCorrect": winner_correct,
        "podiumHitRate": hit_rate(3),
        "top5HitRate": hit_rate(5),
        "top10HitRate": hit_rate(10),
        "meanPositionError": mean_position_error,
    }


def aggregate_metrics(per_race_metrics):
    if not per_race_metrics:
        return {"available": False, "racesEvaluated": 0}

    def avg(key, boolean=False):
        vals = [m[key] for m in per_race_metrics if m[key] is not None]
        if not vals:
            return None
        if boolean:
            return float(np.mean([1.0 if v else 0.0 for v in vals]))
        return float(np.mean(vals))

    return {
        "available": True,
        "racesEvaluated": len(per_race_metrics),
        "winnerAccuracy": avg("winnerCorrect", boolean=True),
        "avgPodiumHitRate": avg("podiumHitRate"),
        "avgTop5HitRate": avg("top5HitRate"),
        "avgTop10HitRate": avg("top10HitRate"),
        "meanPositionError": avg("meanPositionError"),
    }


def rank_within_race(scores, ascending):
    """scores: pandas Series (may contain NaN). Missing scores are pushed
    to the WORST rank — no basis to rank a driver with a missing feature
    better than one with real data. Returns 1..N predictedPosition."""
    filled = scores.fillna(np.inf if ascending else -np.inf)
    return filled.rank(method="first", ascending=ascending).astype(int)


def evaluate_scored_split(df_split_stage, score_col, ascending):
    per_race = []
    for (season, rnd), g in df_split_stage.groupby(["season", "round"]):
        g = g.copy()
        g["predictedPosition"] = rank_within_race(g[score_col], ascending=ascending)
        per_race.append(evaluate_race_group(g.to_dict("records")))
    return aggregate_metrics(per_race)


def evaluate_existing_predictor(df_split_stage, predictions_by_round):
    per_race = []
    for (season, rnd), g in df_split_stage.groupby(["season", "round"]):
        preds = predictions_by_round.get(str(int(rnd)))
        if not preds:
            continue
        pos_by_driver = {p["driverId"]: p["predictedPosition"] for p in preds}
        rows = []
        for r in g.to_dict("records"):
            if r["driverId"] not in pos_by_driver:
                continue
            r = dict(r)
            r["predictedPosition"] = pos_by_driver[r["driverId"]]
            rows.append(r)
        if rows:
            per_race.append(evaluate_race_group(rows))
    return aggregate_metrics(per_race)


# ---------------------------------------------------------------------------
# Model training
# ---------------------------------------------------------------------------

def impute(df, feature_cols, medians):
    out = df.copy()
    for c in feature_cols:
        out[c] = out[c].fillna(medians[c])
    return out


def train_and_score(train_df, eval_df, feature_cols):
    """Fits LR/RF/GB on train_df (classified rows only) and returns a dict
    of score columns appended to eval_df for each model, plus fitted models
    (for feature importance) and training-row counts."""
    train_rows = train_df[train_df["outcome_classification"].isin(SCORABLE_STATUSES)]

    X_train = train_rows[feature_cols].values
    y_train_pos = train_rows["outcome_finishPosition"].values.astype(float)
    y_train_win = (train_rows["outcome_finishPosition"] == 1).astype(int).values

    X_eval = eval_df[feature_cols].values

    models = {}
    scores = {}

    # --- Logistic Regression: P(win), ranked descending -----------------
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_eval_scaled = scaler.transform(X_eval)
    lr = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=RANDOM_STATE)
    lr.fit(X_train_scaled, y_train_win)
    scores["logistic_regression"] = lr.predict_proba(X_eval_scaled)[:, 1]
    models["logistic_regression"] = lr

    # --- Random Forest: regression on finishPosition, ranked ascending --
    rf = RandomForestRegressor(n_estimators=300, max_depth=None, random_state=RANDOM_STATE, n_jobs=-1)
    rf.fit(X_train, y_train_pos)
    scores["random_forest"] = rf.predict(X_eval)
    models["random_forest"] = rf

    # --- Gradient Boosting: regression on finishPosition, ranked ascending
    gb = GradientBoostingRegressor(n_estimators=300, max_depth=3, learning_rate=0.05, random_state=RANDOM_STATE)
    gb.fit(X_train, y_train_pos)
    scores["gradient_boosting"] = gb.predict(X_eval)
    models["gradient_boosting"] = gb

    return models, scores, len(train_rows)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    data = load_dataset()
    df = flatten_samples(data["samples"])
    existing_predictor = data["existingPredictorPredictions"]["byRound"]

    report = {
        "generatedAt": data["generatedAt"],
        "splitDefinition": data["splitDefinition"],
        "stages": {},
    }

    print("=" * 78)
    print("PHASE 4 — OFFLINE ML EVALUATION")
    print("=" * 78)
    print(f"Total samples loaded: {len(df)}")
    print(f"Split definition: {data['splitDefinition']}")

    for stage in STAGES:
        print("\n" + "=" * 78)
        print(f"STAGE: {stage}")
        print("=" * 78)

        df_stage = df[df["stage"] == stage]
        train_df = df_stage[df_stage["split"] == "train"]
        val_df = df_stage[df_stage["split"] == "validation"]
        test_df = df_stage[df_stage["split"] == "test"]

        sample_counts = {
            "train": len(train_df),
            "validation": len(val_df),
            "test": len(test_df),
            "trainClassifiedRows": int(train_df["outcome_classification"].isin(SCORABLE_STATUSES).sum()),
        }
        print(f"Sample counts: {sample_counts}")

        feature_cols = feature_columns_for(train_df)
        print(f"Usable feature columns ({len(feature_cols)}): {[c[len(FEATURE_PREFIX):] for c in feature_cols]}")

        medians = train_df[feature_cols].median()

        train_imp = impute(train_df, feature_cols, medians)
        val_imp = impute(val_df, feature_cols, medians)
        test_imp = impute(test_df, feature_cols, medians)

        stage_report = {"sampleCounts": sample_counts, "featureColumns": [c[len(FEATURE_PREFIX):] for c in feature_cols], "models": {}}

        # ---- Baselines ----------------------------------------------------
        baseline_results = {}
        if f"{FEATURE_PREFIX}championshipStandingScore" in feature_cols:
            col = f"{FEATURE_PREFIX}championshipStandingScore"
            baseline_results["championship_position_baseline"] = {
                "validation": evaluate_scored_split(val_imp, col, ascending=False),
                "test": evaluate_scored_split(test_imp, col, ascending=False),
            }

        if stage == "post_qualifying" and f"{FEATURE_PREFIX}gridPosition" in feature_cols:
            col = f"{FEATURE_PREFIX}gridPosition"
            baseline_results["grid_position_baseline"] = {
                "validation": evaluate_scored_split(val_imp, col, ascending=True),
                "test": evaluate_scored_split(test_imp, col, ascending=True),
            }
        elif stage == "pre_qualifying":
            baseline_results["grid_position_baseline"] = {"note": "not applicable pre-qualifying — grid position does not exist yet (would be leakage)"}

        # ---- Existing hand-weighted predictor (test split only, post-qualifying only) ----
        if stage == "post_qualifying":
            baseline_results["existing_predictor"] = {
                "test": evaluate_existing_predictor(test_df, existing_predictor),
                "note": "predictorService.buildBacktestPrediction always predicts post-qualifying; no pre-qualifying mode exists to compare against",
            }
        else:
            baseline_results["existing_predictor"] = {"note": "not applicable — see post_qualifying stage"}

        stage_report["models"].update(baseline_results)

        # ---- ML models ------------------------------------------------
        if len(feature_cols) > 0 and sample_counts["trainClassifiedRows"] > 50:
            models_val, scores_val, n_train_rows = train_and_score(train_imp, val_imp, feature_cols)
            _, scores_test, _ = train_and_score(train_imp, test_imp, feature_cols)

            val_imp = val_imp.copy()
            test_imp = test_imp.copy()

            ml_ascending = {"logistic_regression": False, "random_forest": True, "gradient_boosting": True}
            for name in ["logistic_regression", "random_forest", "gradient_boosting"]:
                val_imp[f"_score_{name}"] = scores_val[name]
                test_imp[f"_score_{name}"] = scores_test[name]
                stage_report["models"][name] = {
                    "trainRows": n_train_rows,
                    "validation": evaluate_scored_split(val_imp, f"_score_{name}", ascending=ml_ascending[name]),
                    "test": evaluate_scored_split(test_imp, f"_score_{name}", ascending=ml_ascending[name]),
                }

            # Feature importance (tree models only)
            feature_names = [c[len(FEATURE_PREFIX):] for c in feature_cols]
            for name in ["random_forest", "gradient_boosting"]:
                importances = sorted(
                    zip(feature_names, models_val[name].feature_importances_.tolist()),
                    key=lambda x: -x[1],
                )
                stage_report["models"][name]["featureImportance"] = importances
        else:
            print("Skipping ML model training — insufficient classified training rows or no usable features.")

        report["stages"][stage] = stage_report

        # ---- Print stage report -----------------------------------------
        for model_name, result in stage_report["models"].items():
            print(f"\n--- {model_name} ---")
            for split_name in ["validation", "test"]:
                if split_name in result and isinstance(result[split_name], dict):
                    m = result[split_name]
                    if not m.get("available"):
                        print(f"  {split_name}: not available")
                        continue
                    print(
                        f"  {split_name}: races={m['racesEvaluated']} "
                        f"winnerAcc={m['winnerAccuracy']:.3f} "
                        f"podium={m['avgPodiumHitRate']:.3f} "
                        f"top5={m['avgTop5HitRate']:.3f} "
                        f"top10={m['avgTop10HitRate']:.3f} "
                        f"meanPosErr={m['meanPositionError']:.3f}"
                    )
            if "featureImportance" in result:
                top5 = result["featureImportance"][:5]
                print(f"  top features: {top5}")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\nFull results written to {RESULTS_PATH}")


if __name__ == "__main__":
    main()
