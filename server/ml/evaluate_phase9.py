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


def main():
    data = load_dataset()
    df = flatten_samples(data["samples"])
    existing_predictor = data["existingPredictorPredictions"]["byRound"]

    report = {"generatedAt": data.get("generatedAt"), "phase8FeaturesAdded": data.get("phase8FeaturesAdded", OPENF1_FEATURE_KEYS), "stages": {}}

    print("=" * 78)
    print("PHASE 9 — MODEL TRAINING & EVALUATION (does OpenF1 help?)")
    print("=" * 78)
    print(f"Total samples: {len(df)} | OpenF1 features: {report['phase8FeaturesAdded']}")

    for stage in STAGES:
        print("\n" + "=" * 78)
        print(f"STAGE: {stage}")
        print("=" * 78)

        df_stage = df[df["stage"] == stage]
        train_df = df_stage[df_stage["split"] == "train"]
        val_df = df_stage[df_stage["split"] == "validation"]
        test_df = df_stage[df_stage["split"] == "test"]
        print(f"Sample counts: train={len(train_df)} validation={len(val_df)} test={len(test_df)}")

        all_usable_cols = feature_columns_for(train_df)
        openf1_cols = [c for c in all_usable_cols if c[len(FEATURE_PREFIX):] in OPENF1_FEATURE_KEYS]
        without_openf1_cols = [c for c in all_usable_cols if c not in openf1_cols]
        with_openf1_cols = all_usable_cols

        print(f"Feature columns — without OpenF1: {len(without_openf1_cols)} | with OpenF1: {len(with_openf1_cols)} (+{len(openf1_cols)})")

        medians = train_df[all_usable_cols].median()
        train_imp = impute(train_df, all_usable_cols, medians)
        val_imp = impute(val_df, all_usable_cols, medians)
        test_imp = impute(test_df, all_usable_cols, medians)

        stage_report = {
            "sampleCounts": {"train": len(train_df), "validation": len(val_df), "test": len(test_df)},
            "withoutOpenF1FeatureCount": len(without_openf1_cols),
            "withOpenF1FeatureCount": len(with_openf1_cols),
        }

        # ---- Baselines (feature-set independent, reused from evaluate.py logic) ----
        baselines = {}
        if f"{FEATURE_PREFIX}championshipStandingScore" in all_usable_cols:
            col = f"{FEATURE_PREFIX}championshipStandingScore"
            baselines["championship_position_baseline"] = {
                "validation": evaluate_scored_split(val_imp, col, ascending=False),
                "test": evaluate_scored_split(test_imp, col, ascending=False),
            }
        if stage == "post_qualifying" and f"{FEATURE_PREFIX}gridPosition" in all_usable_cols:
            col = f"{FEATURE_PREFIX}gridPosition"
            baselines["grid_position_baseline"] = {
                "validation": evaluate_scored_split(val_imp, col, ascending=True),
                "test": evaluate_scored_split(test_imp, col, ascending=True),
            }
            baselines["existing_predictor"] = {"test": evaluate_existing_predictor(test_df, existing_predictor)}
        stage_report["baselines"] = baselines

        # ---- Two feature-set variants ----
        print("\nTuning WITHOUT OpenF1 features...")
        stage_report["without_openf1"] = run_variant(without_openf1_cols, train_imp, val_imp, test_imp)
        print("Tuning WITH OpenF1 features...")
        stage_report["with_openf1"] = run_variant(with_openf1_cols, train_imp, val_imp, test_imp)

        report["stages"][stage] = stage_report

        # ---- print concise comparison ----
        print(f"\n--- {stage}: baselines (test) ---")
        for name, b in baselines.items():
            m = b.get("test")
            if m and m.get("available"):
                print(f"  {name}: winnerAcc={m['winnerAccuracy']:.3f} podium={m['avgPodiumHitRate']:.3f} top5={m['avgTop5HitRate']:.3f} top10={m['avgTop10HitRate']:.3f} meanPosErr={m['meanPositionError']:.3f}")

        for model_name in ["random_forest", "gradient_boosting", "logistic_regression"]:
            wo = stage_report["without_openf1"][model_name]["test"]
            w = stage_report["with_openf1"][model_name]["test"]
            print(f"\n--- {stage}: {model_name} (test) ---")
            if wo.get("available"):
                print(f"  without OpenF1: winnerAcc={wo['winnerAccuracy']:.3f} podium={wo['avgPodiumHitRate']:.3f} top5={wo['avgTop5HitRate']:.3f} top10={wo['avgTop10HitRate']:.3f} meanPosErr={wo['meanPositionError']:.3f}  params={stage_report['without_openf1'][model_name]['bestParams']}")
            if w.get("available"):
                print(f"  with OpenF1:    winnerAcc={w['winnerAccuracy']:.3f} podium={w['avgPodiumHitRate']:.3f} top5={w['avgTop5HitRate']:.3f} top10={w['avgTop10HitRate']:.3f} meanPosErr={w['meanPositionError']:.3f}  params={stage_report['with_openf1'][model_name]['bestParams']}")

        print(f"\n--- {stage}: DNF AUC (test) ---")
        for model_name in ["logistic_regression", "random_forest"]:
            wo = stage_report["without_openf1"]["dnf"][model_name]
            w = stage_report["with_openf1"]["dnf"][model_name]
            print(f"  {model_name}: without={wo['testAuc']} with={w['testAuc']}")

        rf_importance_with = stage_report["with_openf1"]["random_forest"]["featureImportance"][:8]
        print(f"\n--- {stage}: top features (Random Forest, WITH OpenF1) ---")
        print(" ", rf_importance_with)

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\nFull results written to {RESULTS_PATH}")


if __name__ == "__main__":
    main()
