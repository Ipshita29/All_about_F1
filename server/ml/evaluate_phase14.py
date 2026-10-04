#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 14 — GRID-ANCHORED PREDICTION
═══════════════════════════════════════════════════════════════════

Phase 13's pooled bootstrap (60 races across 2024/2025/2026 pseudo-test
periods) found something the 14-race 2026 test set couldn't see: post-
qualifying, the Phase 12 RF is SIGNIFICANTLY WORSE than just ranking by
grid position alone (meanDiff=+0.277, 95% CI=[0.089, 0.483], excludes
zero). This phase asks why, and whether anchoring the model to grid
position more tightly closes that gap — using the SAME Phase 11 lean
feature set and the SAME Phase 13 rolling periods. No new data, no new
features, no production changes.

Five post-qualifying models, same train/validation/test split per period
as Phase 13 (reused via evaluate_phase13.build_period_splits):

  1. Grid-only baseline        — rank by f_gridPosition directly.
  2. Phase 12 RF                — unchanged: max_depth=4, min_samples_leaf=8.
  3. RF, grid strongly prioritized — same capacity as (2), but the grid
     column is replicated GRID_REPLICAS times in the feature matrix and
     max_features="sqrt" is used (sklearn's default for RandomForestRegressor
     is to consider ALL features at every split, so a duplicated column
     changes nothing there; switching to "sqrt" makes each split consider a
     random subset, and replication raises the odds that at least one copy
     of grid lands in that subset — the standard trick for biasing a
     tree-based model toward one feature without hand-rolling a custom
     splitter).
  4. Grid + RF residual         — target = finishPosition - gridPosition;
     final score = gridPosition + predicted residual. The model only has
     to learn WHO MOVES and by how much, not absolute finishing position.
  5. Grid-anchored ensemble     — score = w*gridPosition + (1-w)*RF(model 2)
     prediction, for w in {0.25, 0.5, 0.75}. w is selected PER PERIOD using
     only that period's validation split (never test), per the task's
     "tune weights only on training/validation data" instruction.

Reuses, never re-implements: PERIODS / build_period_splits / lean_cols_for
(evaluate_phase13.py), RF_PARAMS_BY_STAGE's post_qualifying setting (same
file), metric functions (evaluate.py), per-race/bootstrap helpers
(diagnose_phase10.py), flatten_samples/did_finish (evaluate_phase5.py).

Run: python3 ml/evaluate_phase14.py
"""

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.metrics import roc_auc_score

from evaluate import (
    FEATURE_PREFIX, SCORABLE_STATUSES, RANDOM_STATE,
    impute, evaluate_scored_split,
)
from evaluate_phase5 import flatten_samples, did_finish
from evaluate_phase13 import (
    PERIODS, build_period_splits, lean_cols_for, RF_PARAMS_BY_STAGE, N_ESTIMATORS, load_dataset,
)
from diagnose_phase10 import per_race_metrics, bootstrap_gap

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
RESULTS_PATH = ARTIFACT_DIR / "results_phase14.json"

STAGE = "post_qualifying"  # this phase only concerns the stage with the grid-vs-RF gap
GRID_COL = f"{FEATURE_PREFIX}gridPosition"
POST_PARAMS = RF_PARAMS_BY_STAGE[STAGE]  # {"max_depth": 4, "min_samples_leaf": 8} — unchanged from Phase 12

GRID_REPLICAS = 10
ENSEMBLE_GRID_WEIGHTS = [0.25, 0.5, 0.75]  # fraction of score coming from grid position


def build_matrix_with_grid_replicas(d, cols):
    base = d[cols].values
    grid_block = np.repeat(d[[GRID_COL]].values, GRID_REPLICAS, axis=1)
    return np.hstack([base, grid_block])


def fit_models(train_rows, cols):
    y_pos = train_rows["outcome_finishPosition"].values.astype(float)
    grid_train = train_rows[GRID_COL].values.astype(float)

    rf12 = RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1, **POST_PARAMS)
    rf12.fit(train_rows[cols].values, y_pos)

    rf_prior = RandomForestRegressor(
        n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1, max_features="sqrt", **POST_PARAMS
    )
    rf_prior.fit(build_matrix_with_grid_replicas(train_rows, cols), y_pos)

    rf_resid = RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1, **POST_PARAMS)
    rf_resid.fit(train_rows[cols].values, y_pos - grid_train)

    return rf12, rf_prior, rf_resid


def score_columns(d, cols, rf12, rf_prior, rf_resid, ensemble_weight):
    grid_score = d[GRID_COL].values.astype(float)
    rf12_score = rf12.predict(d[cols].values)
    rf_prior_score = rf_prior.predict(build_matrix_with_grid_replicas(d, cols))
    resid_score = grid_score + rf_resid.predict(d[cols].values)
    ensemble_score = ensemble_weight * grid_score + (1 - ensemble_weight) * rf12_score
    return {
        "grid_only": grid_score,
        "phase12_rf": rf12_score,
        "rf_grid_prioritized": rf_prior_score,
        "grid_plus_residual": resid_score,
        f"ensemble_w{ensemble_weight}": ensemble_score,
    }


def evaluate_with_score(d_imp, score_array):
    d = d_imp.copy()
    d["_score"] = score_array
    return evaluate_scored_split(d, "_score", ascending=True), d


def select_ensemble_weight(val_imp, cols, rf12):
    grid_score = val_imp[GRID_COL].values.astype(float)
    rf_score = rf12.predict(val_imp[cols].values)
    best_w, best_err = None, None
    tried = {}
    for w in ENSEMBLE_GRID_WEIGHTS:
        combo = w * grid_score + (1 - w) * rf_score
        metrics, _ = evaluate_with_score(val_imp, combo)
        err = metrics.get("meanPositionError")
        tried[w] = err
        if err is not None and (best_err is None or err < best_err):
            best_w, best_err = w, err
    return best_w, tried


def evaluate_period(df, period):
    train_df, val_df, test_df = build_period_splits(df, STAGE, period)
    cols = lean_cols_for(train_df)
    medians = train_df[cols].median()
    train_imp = impute(train_df, cols, medians)
    val_imp = impute(val_df, cols, medians)
    test_imp = impute(test_df, cols, medians)
    train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]

    rf12, rf_prior, rf_resid = fit_models(train_rows, cols)

    # Ensemble weight tuned on THIS period's validation split only.
    best_w, weight_search = select_ensemble_weight(val_imp, cols, rf12)

    test_scores = score_columns(test_imp, cols, rf12, rf_prior, rf_resid, best_w)

    model_results = {}
    per_race_by_model = {}
    for name, score_array in test_scores.items():
        label = "grid_anchored_ensemble" if name.startswith("ensemble_w") else name
        metrics, scored_df = evaluate_with_score(test_imp, score_array)
        model_results[label] = metrics
        per_race_by_model[label] = per_race_metrics(scored_df, "_score", ascending=True)

    # Shared DNF classifier (unaffected by which position-ranking model is used —
    # all four RF-based variants share the same lean feature set and post-qualifying
    # capacity settings; DNF prediction is not part of what's being varied here).
    for d in (train_imp, test_imp):
        if "target_didFinish" not in d.columns:
            d["target_didFinish"] = d["outcome_status"].apply(did_finish)
    train_dnf = train_imp[train_imp["target_didFinish"].notna()]
    test_dnf = test_imp[test_imp["target_didFinish"].notna()]
    dnf_auc = None
    if train_dnf["target_didFinish"].nunique() >= 2:
        rf_dnf = RandomForestClassifier(
            n_estimators=N_ESTIMATORS, class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1, **POST_PARAMS
        )
        rf_dnf.fit(train_dnf[cols].values, train_dnf["target_didFinish"].values.astype(int))
        y_test = test_dnf["target_didFinish"].values.astype(int)
        if len(set(y_test)) >= 2:
            dnf_auc = float(roc_auc_score(y_test, rf_dnf.predict_proba(test_dnf[cols].values)[:, 1]))

    return {
        "period": period["label"],
        "trainRaces": int(train_df[["season", "round"]].drop_duplicates().shape[0]),
        "valRaces": int(val_df[["season", "round"]].drop_duplicates().shape[0]),
        "testRaces": int(test_df[["season", "round"]].drop_duplicates().shape[0]),
        "ensembleWeightSearch": weight_search,
        "ensembleWeightChosen": best_w,
        "models": model_results,
        "dnfAucSharedAcrossRfModels": dnf_auc,
        "_perRaceByModel": per_race_by_model,
    }


def mean_std(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return {"mean": None, "std": None, "n": 0}
    return {"mean": float(np.mean(vals)), "std": float(np.std(vals)), "n": len(vals)}


