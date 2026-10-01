#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 12 — RANDOM FOREST REGULARIZATION (CAPACITY CONTROL)
═══════════════════════════════════════════════════════════════════

Phase 11 found Gradient Boosting's overfitting gap shrank when redundant
features were removed, but Random Forest's barely moved — RF could still
carve the lean (23/28-feature) set into deep enough trees to nearly
memorize the 879-row training set. Phase 11's own grid only varied
n_estimators/max_depth loosely (and only two max_depth values); this
phase runs a focused, single-purpose sweep over the two hyperparameters
that actually cap a tree's capacity to memorize: max_depth and
min_samples_leaf — holding everything else (features, n_estimators,
target, data) fixed.

Reuses, never re-implements: the lean feature definition (REMOVED_FEATURES,
imported from evaluate_phase11.py), the metric functions (evaluate.py),
the per-race/bootstrap noise-analysis helpers (diagnose_phase10.py).

GRID (5 x 4 = 20 points, n_estimators fixed at 300 — the same default
Phase 4/5/10 have used throughout, so only max_depth/min_samples_leaf
vary, isolating their effect):
  max_depth:        4, 6, 8, 10, None
  min_samples_leaf: 1, 2, 4, 8

Selection is via VALIDATION (2025) only — meanPositionError for the
finishPosition regressor, ROC-AUC for the DNF classifier — exactly
Phase 9/11's own selection rule. 2026 is scored exactly once, after
the grid search is complete, never used to pick a configuration.

Run: python3 ml/evaluate_phase12.py
"""

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.metrics import roc_auc_score

from evaluate import FEATURE_PREFIX, STAGES, SCORABLE_STATUSES, RANDOM_STATE, feature_columns_for, impute, evaluate_scored_split
from evaluate_phase5 import flatten_samples, did_finish
from evaluate_phase11 import REMOVED_FEATURES
from diagnose_phase10 import per_race_metrics, bootstrap_gap

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
DATASET_PATH = ARTIFACT_DIR / "dataset_phase5.json"  # NOT phase8 — no OpenF1
RESULTS_PHASE5_PATH = ARTIFACT_DIR / "results_phase5.json"
RESULTS_PATH = ARTIFACT_DIR / "results_phase12.json"

N_ESTIMATORS = 300  # fixed throughout — only max_depth/min_samples_leaf vary
MAX_DEPTH_GRID = [4, 6, 8, 10, None]
MIN_SAMPLES_LEAF_GRID = [1, 2, 4, 8]


def load_dataset():
    with open(DATASET_PATH) as f:
        return json.load(f)


def lean_cols_for(train_df):
    full_cols = feature_columns_for(train_df)
    return [c for c in full_cols if c[len(FEATURE_PREFIX):] not in REMOVED_FEATURES]


# ---------------------------------------------------------------------------
# Regressor grid (finishPosition) — full grid results kept, not just the best
# ---------------------------------------------------------------------------

def sweep_regressor(train_rows, cols, val_df):
    grid_results = []
    best = None
    for max_depth in MAX_DEPTH_GRID:
        for min_samples_leaf in MIN_SAMPLES_LEAF_GRID:
            model = RandomForestRegressor(
                n_estimators=N_ESTIMATORS, max_depth=max_depth, min_samples_leaf=min_samples_leaf,
                random_state=RANDOM_STATE, n_jobs=-1,
            )
            model.fit(train_rows[cols].values, train_rows["outcome_finishPosition"].values.astype(float))
            scored = val_df.copy()
            scored["_score"] = model.predict(val_df[cols].values)
            val_metrics = evaluate_scored_split(scored, "_score", ascending=True)
            key = val_metrics["meanPositionError"] if val_metrics.get("available") and val_metrics.get("meanPositionError") is not None else float("inf")
            entry = {"max_depth": max_depth, "min_samples_leaf": min_samples_leaf, "validationMeanPositionError": key, "validationWinnerAccuracy": val_metrics.get("winnerAccuracy")}
            grid_results.append(entry)
            if best is None or key < best["key"]:
                best = {"params": {"max_depth": max_depth, "min_samples_leaf": min_samples_leaf}, "model": model, "key": key, "valMetrics": val_metrics}
    return best, grid_results


def sweep_classifier(train_rows, cols, val_rows):
    y_train = train_rows["target_didFinish"].values.astype(int)
    y_val = val_rows["target_didFinish"].values.astype(int)
    can_score = len(set(y_val)) >= 2
    grid_results = []
    best = None
    for max_depth in MAX_DEPTH_GRID:
        for min_samples_leaf in MIN_SAMPLES_LEAF_GRID:
            model = RandomForestClassifier(
                n_estimators=N_ESTIMATORS, max_depth=max_depth, min_samples_leaf=min_samples_leaf,
                class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1,
            )
            model.fit(train_rows[cols].values, y_train)
            auc = float(roc_auc_score(y_val, model.predict_proba(val_rows[cols].values)[:, 1])) if can_score else 0.5
            entry = {"max_depth": max_depth, "min_samples_leaf": min_samples_leaf, "validationAuc": auc}
            grid_results.append(entry)
            if best is None or auc > best["key"]:
                best = {"params": {"max_depth": max_depth, "min_samples_leaf": min_samples_leaf}, "model": model, "key": auc}
    return best, grid_results


def main():
    data = load_dataset()
    df = flatten_samples(data["samples"])
    with open(RESULTS_PHASE5_PATH) as f:
        phase5_results = json.load(f)

    report = {"grid": {"n_estimators": N_ESTIMATORS, "max_depth": MAX_DEPTH_GRID, "min_samples_leaf": MIN_SAMPLES_LEAF_GRID}, "stages": {}}

    print("=" * 78)
    print("PHASE 12 — RANDOM FOREST REGULARIZATION")
    print("=" * 78)
    print(f"Grid: max_depth={MAX_DEPTH_GRID} x min_samples_leaf={MIN_SAMPLES_LEAF_GRID} (n_estimators fixed at {N_ESTIMATORS})")

    for stage in STAGES:
        print(f"\n{'=' * 78}\nSTAGE: {stage}\n{'=' * 78}")

        stage_df = df[df["stage"] == stage]
        train_df = stage_df[stage_df["split"] == "train"]
        val_df = stage_df[stage_df["split"] == "validation"]
        test_df = stage_df[stage_df["split"] == "test"]

        cols = lean_cols_for(train_df)
        medians = train_df[cols].median()
        train_imp = impute(train_df, cols, medians)
        val_imp = impute(val_df, cols, medians)
        test_imp = impute(test_df, cols, medians)
        train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]

        print(f"Lean feature count: {len(cols)} | train rows: {len(train_rows)}")

        # ---- finishPosition regressor sweep ----
        print("\nSweeping finishPosition regressor (20 configurations)...")
        best_reg, reg_grid = sweep_regressor(train_rows, cols, val_imp)
        print(f"Best: max_depth={best_reg['params']['max_depth']} min_samples_leaf={best_reg['params']['min_samples_leaf']} (validation meanPosErr={best_reg['key']:.3f})")

        train_scored = train_imp.copy(); train_scored["_score"] = best_reg["model"].predict(train_imp[cols].values)
        test_scored = test_imp.copy(); test_scored["_score"] = best_reg["model"].predict(test_imp[cols].values)
        train_metrics = evaluate_scored_split(train_scored, "_score", ascending=True)
        test_metrics = evaluate_scored_split(test_scored, "_score", ascending=True)
        test_per_race_regularized = per_race_metrics(test_imp.assign(_score=best_reg["model"].predict(test_imp[cols].values)), "_score", ascending=True)

        # ---- DNF classifier sweep ----
        for d in (train_imp, val_imp, test_imp):
            if "target_didFinish" not in d.columns:
                d["target_didFinish"] = d["outcome_status"].apply(did_finish)
        train_dnf = train_imp[train_imp["target_didFinish"].notna()]
        val_dnf = val_imp[val_imp["target_didFinish"].notna()]
        test_dnf = test_imp[test_imp["target_didFinish"].notna()]

        print("\nSweeping DNF classifier (20 configurations)...")
        best_clf, clf_grid = sweep_classifier(train_dnf, cols, val_dnf)
        print(f"Best: max_depth={best_clf['params']['max_depth']} min_samples_leaf={best_clf['params']['min_samples_leaf']} (validation AUC={best_clf['key']:.3f})")
        y_test = test_dnf["target_didFinish"].values.astype(int)
        test_auc = None
        if len(set(y_test)) >= 2:
            test_auc = float(roc_auc_score(y_test, best_clf["model"].predict_proba(test_dnf[cols].values)[:, 1]))

        # ---- Reference 1: Phase 11 lean RF, refit with ITS exact best params, same lean cols ----
        with open(ARTIFACT_DIR / "results_phase11.json") as f:
            p11 = json.load(f)
        p11_params = p11["stages"][stage]["lean"]["random_forest"]["bestParams"]
        p11_model = RandomForestRegressor(n_estimators=p11_params["n_estimators"], max_depth=p11_params["max_depth"], random_state=RANDOM_STATE, n_jobs=-1)
        p11_model.fit(train_rows[cols].values, train_rows["outcome_finishPosition"].values.astype(float))
        p11_test_per_race = per_race_metrics(test_imp.assign(_score=p11_model.predict(test_imp[cols].values)), "_score", ascending=True)
        p11_test_metrics = evaluate_scored_split(test_imp.assign(_score=p11_model.predict(test_imp[cols].values)), "_score", ascending=True)
        p11_train_metrics = evaluate_scored_split(train_imp.assign(_score=p11_model.predict(train_imp[cols].values)), "_score", ascending=True)

        # ---- Bootstrap: does regularization actually move the needle vs noise? ----
        gap_vs_phase11 = bootstrap_gap(test_per_race_regularized, p11_test_per_race)

        # ---- Reference 2: Phase 5 original baseline (full feature set, untuned RF, n_estimators=300) — tabulated only, different feature set so no direct per-race bootstrap here ----
        phase5_rf_test = phase5_results["stages"][stage]["finishPosition_phase4_plus_phase5_features"]["test"]

        stage_report = {
            "leanFeatureCount": len(cols),
            "regressorGrid": reg_grid,
            "classifierGrid": clf_grid,
            "bestRegressor": {"params": best_reg["params"], "validation": best_reg["valMetrics"], "train": train_metrics, "test": test_metrics},
            "bestClassifierDnf": {"params": best_clf["params"], "validationAuc": best_clf["key"], "testAuc": test_auc},
            "phase11LeanReference": {"params": p11_params, "train": p11_train_metrics, "test": p11_test_metrics},
            "phase5BaselineReference_fullFeatureSet": phase5_rf_test,
            "bootstrapRegularizedVsPhase11Lean": gap_vs_phase11,
        }
        report["stages"][stage] = stage_report

        print(f"\n--- {stage}: REGULARIZED RF (test) ---")
        print(f"  train:      winnerAcc={train_metrics['winnerAccuracy']:.3f} meanPosErr={train_metrics['meanPositionError']:.3f}")
        print(f"  test:       winnerAcc={test_metrics['winnerAccuracy']:.3f} podium={test_metrics['avgPodiumHitRate']:.3f} top5={test_metrics['avgTop5HitRate']:.3f} top10={test_metrics['avgTop10HitRate']:.3f} meanPosErr={test_metrics['meanPositionError']:.3f}")
        print(f"  train-test gap (meanPosErr): {train_metrics['meanPositionError'] - test_metrics['meanPositionError']:.3f}")
        print(f"  DNF AUC (test): {test_auc}")

        print(f"\n--- {stage}: PHASE 11 LEAN RF (reference, refit for per-race comparison) ---")
        print(f"  train:      winnerAcc={p11_train_metrics['winnerAccuracy']:.3f} meanPosErr={p11_train_metrics['meanPositionError']:.3f}")
        print(f"  test:       winnerAcc={p11_test_metrics['winnerAccuracy']:.3f} meanPosErr={p11_test_metrics['meanPositionError']:.3f}")
        print(f"  train-test gap (meanPosErr): {p11_train_metrics['meanPositionError'] - p11_test_metrics['meanPositionError']:.3f}")

        print(f"\n--- {stage}: PHASE 5 BASELINE (full feature set, untuned, reference only) ---")
        print(f"  test: winnerAcc={phase5_rf_test.get('winnerAccuracy')} meanPosErr={phase5_rf_test.get('meanPositionError')}")

        print(f"\n--- {stage}: bootstrap — regularized RF vs Phase 11 lean RF (test races) ---")
        if gap_vs_phase11.get("available"):
            print(f"  meanDiff={gap_vs_phase11['meanDiff']:.3f} 95% CI=[{gap_vs_phase11['ci95'][0]:.3f}, {gap_vs_phase11['ci95'][1]:.3f}] excludesZero={gap_vs_phase11['ciExcludesZero']}")

    with open(RESULTS_PATH, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\nFull results written to {RESULTS_PATH}")


if __name__ == "__main__":
    main()
