#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 9 — MODEL TRAINING & EVALUATION: DO THE OPENF1 FEATURES HELP?
═══════════════════════════════════════════════════════════════════

Phase 8 added 9 leakage-safe OpenF1 race-pace features to the existing
Phase 4/5 dataset (dataset_phase8.json — same samples, same splits, same
labels as dataset_phase5.json, just 9 extra mlFeatures keys). This script
answers one question: do they actually improve prediction, on the exact
same held-out 2026 test races Phase 4/5 already evaluated against?

Three-way comparison, reusing evaluate.py's/evaluate_phase5.py's own
metric and data-loading functions UNCHANGED (never re-implemented):
  1. Baselines (grid-position, championship-position, the real existing
     predictor's own captured predictions) — feature-set independent,
     reused directly from evaluate.py.
  2. "without_openf1" — the Phase 4+5 feature columns only.
  3. "with_openf1"    — Phase 4+5 columns + the 9 Phase 8 columns.

HYPERPARAMETER TUNING (new in Phase 9)
Phase 4/5 deliberately used fixed, reasonable defaults with no tuning,
to avoid "optimizing for the 50% winner-accuracy number." Phase 9 asks
for real tuning, so a small, explicit grid per model is searched —
selecting each combination's score with THIS PROJECT'S OWN evaluation
functions (evaluate_scored_split, imported from evaluate.py) computed on
the VALIDATION split only. The chosen model is then evaluated on TEST
exactly once; test numbers are never looked at during selection, and
2026 never appears in any training or tuning data (train=2023-2024,
validation=2025, test=2026 — same as every prior phase).

Run: python3 ml/evaluate_phase9.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score

from evaluate import (
    FEATURE_PREFIX, STAGES, SPLITS, SCORABLE_STATUSES, RANDOM_STATE,
    feature_columns_for, impute, evaluate_scored_split, evaluate_existing_predictor,
)
from evaluate_phase5 import flatten_samples, did_finish

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
DATASET_PATH = ARTIFACT_DIR / "dataset_phase8.json"
RESULTS_PATH = ARTIFACT_DIR / "results_phase9.json"

OPENF1_FEATURE_KEYS = [
    "openf1RacePaceRatio", "openf1TeammatePaceDelta", "openf1StintPaceRatio",
    "openf1TyreDegradationRate", "openf1Sector1PaceRatio", "openf1Sector2PaceRatio",
    "openf1Sector3PaceRatio", "openf1AvgPitStopDuration", "openf1AvgPitStopsPerRace",
]

# Small, explicit, "reasonable" grids — not an exhaustive search. Selected
# on validation only; see tune_* functions below.
RF_REG_GRID = [
    {"n_estimators": 200, "max_depth": None},
    {"n_estimators": 200, "max_depth": 12},
    {"n_estimators": 400, "max_depth": None},
    {"n_estimators": 400, "max_depth": 12},
]
GB_REG_GRID = [
    {"n_estimators": 200, "max_depth": 2, "learning_rate": 0.05},
    {"n_estimators": 200, "max_depth": 3, "learning_rate": 0.05},
    {"n_estimators": 400, "max_depth": 2, "learning_rate": 0.05},
    {"n_estimators": 400, "max_depth": 3, "learning_rate": 0.1},
]
LR_GRID = [{"C": 0.1}, {"C": 1.0}, {"C": 10.0}]
RF_CLS_GRID = [
    {"n_estimators": 200, "max_depth": None},
    {"n_estimators": 200, "max_depth": 10},
    {"n_estimators": 400, "max_depth": None},
    {"n_estimators": 400, "max_depth": 10},
]


def load_dataset():
    with open(DATASET_PATH) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Tuning — every selection uses the PROJECT'S OWN evaluate_scored_split /
# aggregate_metrics (imported, not re-implemented), computed on validation
# only, exactly like Phase 4/5's reported numbers.
# ---------------------------------------------------------------------------

def tune_finish_position_regressor(model_cls, grid, train_rows, feature_cols, val_df, fixed=None):
    fixed = fixed or {}
    X_train = train_rows[feature_cols].values
    y_train = train_rows["outcome_finishPosition"].values.astype(float)
    best = None
    for params in grid:
        model = model_cls(random_state=RANDOM_STATE, **params, **fixed)
        model.fit(X_train, y_train)
        scored = val_df.copy()
        scored["_score"] = model.predict(val_df[feature_cols].values)
        metrics = evaluate_scored_split(scored, "_score", ascending=True)
        key = metrics["meanPositionError"] if metrics.get("available") and metrics.get("meanPositionError") is not None else float("inf")
        if best is None or key < best["key"]:
            best = {"params": params, "model": model, "key": key, "valMetrics": metrics}
    return best


def tune_winner_classifier(grid, train_rows, feature_cols, val_df):
    X_train = train_rows[feature_cols].values
    y_train = (train_rows["outcome_finishPosition"] == 1).astype(int).values
    scaler = StandardScaler().fit(X_train)
    X_train_scaled = scaler.transform(X_train)
    best = None
    for params in grid:
        model = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=RANDOM_STATE, **params)
        model.fit(X_train_scaled, y_train)
        scored = val_df.copy()
        scored["_score"] = model.predict_proba(scaler.transform(val_df[feature_cols].values))[:, 1]
        metrics = evaluate_scored_split(scored, "_score", ascending=False)
        key = metrics["winnerAccuracy"] if metrics.get("available") and metrics.get("winnerAccuracy") is not None else -1
        if best is None or key > best["key"]:
            best = {"params": params, "model": model, "scaler": scaler, "key": key, "valMetrics": metrics}
    return best


def tune_dnf_classifier(model_cls, grid, train_rows, feature_cols, val_rows, needs_scaling):
    X_train = train_rows[feature_cols].values
    y_train = train_rows["target_didFinish"].values.astype(int)
    scaler = StandardScaler().fit(X_train) if needs_scaling else None
    X_train_fit = scaler.transform(X_train) if scaler else X_train

    y_val = val_rows["target_didFinish"].values.astype(int)
    X_val = val_rows[feature_cols].values
    X_val_eval = scaler.transform(X_val) if scaler else X_val
    can_score = len(set(y_val)) >= 2

    best = None
    for params in grid:
        kwargs = dict(params)
        if model_cls is LogisticRegression:
            kwargs.update(max_iter=2000, class_weight="balanced", random_state=RANDOM_STATE)
        else:
            kwargs.update(class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1)
        model = model_cls(**kwargs)
        model.fit(X_train_fit, y_train)
        auc = roc_auc_score(y_val, model.predict_proba(X_val_eval)[:, 1]) if can_score else 0.5
        if best is None or auc > best["key"]:
            best = {"params": params, "model": model, "scaler": scaler, "key": auc}
    return best


def eval_dnf_test(best, test_rows, feature_cols):
    X_test = test_rows[feature_cols].values
    if best["scaler"] is not None:
        X_test = best["scaler"].transform(X_test)
    y_test = test_rows["target_didFinish"].values.astype(int)
    if len(set(y_test)) < 2:
        return None
    proba = best["model"].predict_proba(X_test)[:, 1]
    return float(roc_auc_score(y_test, proba))


# ---------------------------------------------------------------------------
# One feature-set variant, one stage
# ---------------------------------------------------------------------------

def run_variant(feature_cols, train_imp, val_imp, test_imp):
    feature_names = [c[len(FEATURE_PREFIX):] for c in feature_cols]
    train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]

    result = {"featureCount": len(feature_cols)}

    # ---- finishPosition: RF, GB ----
    rf = tune_finish_position_regressor(RandomForestRegressor, RF_REG_GRID, train_rows, feature_cols, val_imp, fixed={"n_jobs": -1})
    rf_test_scored = test_imp.copy()
    rf_test_scored["_score"] = rf["model"].predict(test_imp[feature_cols].values)
    result["random_forest"] = {
        "bestParams": rf["params"],
        "validation": rf["valMetrics"],
        "test": evaluate_scored_split(rf_test_scored, "_score", ascending=True),
        "featureImportance": sorted(zip(feature_names, rf["model"].feature_importances_.tolist()), key=lambda x: -x[1])[:15],
    }

    gb = tune_finish_position_regressor(GradientBoostingRegressor, GB_REG_GRID, train_rows, feature_cols, val_imp)
    gb_test_scored = test_imp.copy()
    gb_test_scored["_score"] = gb["model"].predict(test_imp[feature_cols].values)
    result["gradient_boosting"] = {
        "bestParams": gb["params"],
        "validation": gb["valMetrics"],
        "test": evaluate_scored_split(gb_test_scored, "_score", ascending=True),
        "featureImportance": sorted(zip(feature_names, gb["model"].feature_importances_.tolist()), key=lambda x: -x[1])[:15],
    }

    # ---- winner-probability LR ----
    lr = tune_winner_classifier(LR_GRID, train_rows, feature_cols, val_imp)
    lr_test_scored = test_imp.copy()
    lr_test_scored["_score"] = lr["model"].predict_proba(lr["scaler"].transform(test_imp[feature_cols].values))[:, 1]
    result["logistic_regression"] = {
        "bestParams": lr["params"],
        "validation": lr["valMetrics"],
        "test": evaluate_scored_split(lr_test_scored, "_score", ascending=False),
    }

    # ---- DNF (didFinish) ----
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
        "random_forest": {
            "bestParams": rf_dnf["params"], "validationAuc": rf_dnf["key"], "testAuc": eval_dnf_test(rf_dnf, test_dnf, feature_cols),
            "featureImportance": sorted(zip(feature_names, rf_dnf["model"].feature_importances_.tolist()), key=lambda x: -x[1])[:15],
        },
    }

    return result
