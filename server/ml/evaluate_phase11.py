#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 11 — FEATURE REDUNDANCY REDUCTION & LEAN MODEL VALIDATION
═══════════════════════════════════════════════════════════════════

Phase 10 found severe overfitting (train meanPositionError 4-5x better
than validation/test) and traced a large part of it to feature
redundancy: dozens of feature pairs at r >= 0.90 in the Phase 5 set,
including one PERFECT duplicate (circuitHistoricalScore vs
circuitAvgFinish, r = -1.0). This script builds a leaner feature set
from that evidence, trains the exact same models/grids Phase 9 already
used (imported from evaluate_phase9.py, never re-implemented), and
checks whether trimming redundancy actually reduces the train/val/test
gap while holding held-out performance.

Uses dataset_phase5.json — NOT dataset_phase8 — no OpenF1 features
anywhere in this comparison, per instruction.

REMOVAL DECISIONS (every r >= 0.90 pair from Phase 10's own
results_phase10.json, judged individually — not a blanket cut)
  REMOVED (near-duplicate of another kept feature, same information,
  simpler feature preferred):
    circuitAvgFinish            -> duplicate of circuitHistoricalScore (r=-1.0, EXACT)
    avgPointsLast3              -> same stat as avgPointsLast5, shorter window
    avgFinishLast3              -> same stat as avgFinishLast5, shorter window
    avgFinishLast5              -> position-based; avgPointsLast5 carries the same
                                    "recent form" signal with more granularity
                                    (F1 points are non-linear in position, finish
                                    position isn't) — keep the richer encoding
    teammatePointsDeltaLast3    -> same stat as teammatePointsDelta, shorter window
    teammateQualifyingDeltaLast3-> same stat as teammateQualifyingDeltaLast5, shorter window
    teammateRaceDeltaLast3      -> same stat as teammateRaceDelta, shorter window

  KEPT DESPITE r >= 0.90 (judged to carry genuinely different information,
  not just a relabeling of the same signal — Phase 11 requirement 4):
    championshipStandingScore vs avgPointsLast5 (r=0.924)
      -> season-long cumulative standing vs a short recent-form window;
         correlated because recent form feeds the season standing, but
         answer different questions ("who is this driver overall" vs
         "how are they trending right now").
    constructorRecentAvgFinish vs constructorRecentQualifyingAvgLast5 (r=0.902)
      -> constructor's recent RACE pace vs recent QUALIFYING pace — a team
         can genuinely diverge between the two (e.g. strong one-lap pace,
         weaker race-day execution), which is exactly the kind of signal
         worth keeping separate.
    gridPosition vs qualifyingPosition (r=0.931, post-qualifying only)
      -> identical except when a grid penalty applies — which is precisely
         the case this pair exists to capture; collapsing them would
         discard the one thing that makes them worth having both.

Run: python3 ml/evaluate_phase11.py
"""

import json
from pathlib import Path

from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, RandomForestClassifier
from sklearn.linear_model import LogisticRegression

from evaluate import FEATURE_PREFIX, STAGES, SCORABLE_STATUSES, feature_columns_for, impute, evaluate_scored_split
from evaluate_phase5 import flatten_samples, did_finish
from evaluate_phase9 import (
    tune_finish_position_regressor, tune_winner_classifier, tune_dnf_classifier, eval_dnf_test,
    RF_REG_GRID, GB_REG_GRID, LR_GRID, RF_CLS_GRID,
)

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
DATASET_PATH = ARTIFACT_DIR / "dataset_phase5.json"  # NOT phase8 — no OpenF1, per instruction
RESULTS_PATH = ARTIFACT_DIR / "results_phase11.json"

REMOVED_FEATURES = [
    "circuitAvgFinish",
    "avgPointsLast3",
    "avgFinishLast3",
    "avgFinishLast5",
    "teammatePointsDeltaLast3",
    "teammateQualifyingDeltaLast3",
    "teammateRaceDeltaLast3",
]


def load_dataset():
    with open(DATASET_PATH) as f:
        return json.load(f)


def run_variant_with_train_gap(feature_cols, train_imp, val_imp, test_imp):
    """Same models/grids as evaluate_phase9.run_variant, but also scores
    the chosen model on TRAIN itself, so the train/validation/test gap
    (Phase 11 requirement 9) can be reported directly — evaluate_phase9.py
    itself is left untouched; its tune_* functions are reused as-is."""
    feature_names = [c[len(FEATURE_PREFIX):] for c in feature_cols]
    train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]

    result = {"featureCount": len(feature_cols)}

    rf = tune_finish_position_regressor(RandomForestRegressor, RF_REG_GRID, train_rows, feature_cols, val_imp, fixed={"n_jobs": -1})
    rf_train_scored = train_imp.copy(); rf_train_scored["_score"] = rf["model"].predict(train_imp[feature_cols].values)
    rf_test_scored = test_imp.copy(); rf_test_scored["_score"] = rf["model"].predict(test_imp[feature_cols].values)
    result["random_forest"] = {
        "bestParams": rf["params"],
        "train": evaluate_scored_split(rf_train_scored, "_score", ascending=True),
        "validation": rf["valMetrics"],
        "test": evaluate_scored_split(rf_test_scored, "_score", ascending=True),
        "featureImportance": sorted(zip(feature_names, rf["model"].feature_importances_.tolist()), key=lambda x: -x[1])[:15],
    }

    gb = tune_finish_position_regressor(GradientBoostingRegressor, GB_REG_GRID, train_rows, feature_cols, val_imp)
    gb_train_scored = train_imp.copy(); gb_train_scored["_score"] = gb["model"].predict(train_imp[feature_cols].values)
    gb_test_scored = test_imp.copy(); gb_test_scored["_score"] = gb["model"].predict(test_imp[feature_cols].values)
    result["gradient_boosting"] = {
        "bestParams": gb["params"],
        "train": evaluate_scored_split(gb_train_scored, "_score", ascending=True),
        "validation": gb["valMetrics"],
        "test": evaluate_scored_split(gb_test_scored, "_score", ascending=True),
        "featureImportance": sorted(zip(feature_names, gb["model"].feature_importances_.tolist()), key=lambda x: -x[1])[:15],
    }

    lr = tune_winner_classifier(LR_GRID, train_rows, feature_cols, val_imp)
    lr_train_scored = train_imp.copy(); lr_train_scored["_score"] = lr["model"].predict_proba(lr["scaler"].transform(train_imp[feature_cols].values))[:, 1]
    lr_test_scored = test_imp.copy(); lr_test_scored["_score"] = lr["model"].predict_proba(lr["scaler"].transform(test_imp[feature_cols].values))[:, 1]
    result["logistic_regression"] = {
        "bestParams": lr["params"],
        "train": evaluate_scored_split(lr_train_scored, "_score", ascending=False),
        "validation": lr["valMetrics"],
        "test": evaluate_scored_split(lr_test_scored, "_score", ascending=False),
    }

    for df in (train_imp, val_imp, test_imp):
        if "target_didFinish" not in df.columns:
            df["target_didFinish"] = df["outcome_status"].apply(did_finish)
    train_dnf = train_imp[train_imp["target_didFinish"].notna()]
    val_dnf = val_imp[val_imp["target_didFinish"].notna()]
    test_dnf = test_imp[test_imp["target_didFinish"].notna()]

    lr_dnf = tune_dnf_classifier(LogisticRegression, LR_GRID, train_dnf, feature_cols, val_dnf, needs_scaling=True)
    rf_dnf = tune_dnf_classifier(RandomForestClassifier, RF_CLS_GRID, train_dnf, feature_cols, val_dnf, needs_scaling=False)
    result["dnf"] = {
        "logistic_regression": {"bestParams": lr_dnf["params"], "validationAuc": lr_dnf["key"], "testAuc": eval_dnf_test(lr_dnf, test_dnf, feature_cols)},
        "random_forest": {"bestParams": rf_dnf["params"], "validationAuc": rf_dnf["key"], "testAuc": eval_dnf_test(rf_dnf, test_dnf, feature_cols)},
    }
    return result
