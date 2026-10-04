#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 19 — FINAL MODEL VALIDATION & PRODUCTION CANDIDATE
═══════════════════════════════════════════════════════════════════

The final phase in the Phase 9-18 accuracy-improvement arc. No new
search of any kind — this locks exactly four already-chosen candidates
and re-evaluates them cleanly, once, on the same rolling 2024/2025/2026
periods (60 pooled test races) used throughout:

  PRE:  championship-only baseline   vs   Phase 12 PRE RF (unchanged:
        max_depth=None, min_samples_leaf=1)
  POST: grid-only baseline           vs   Phase 16 core_subset
        grid-anchored ensemble (weight re-selected from {0.25,0.5,0.75}
        on each period's own validation split only, exactly as every
        prior phase did it — not a new search, a clean re-run)

No tuning on test data anywhere in this file. Reuses, never
re-implements: PERIODS / build_period_splits / lean_cols_for /
RF_PARAMS_BY_STAGE / N_ESTIMATORS / load_dataset (evaluate_phase13.py),
PHASE14_WEIGHTS / select_weight / evaluate_with_score / shared_dnf_auc /
GRID_COL (evaluate_phase15.py), variant_spec (evaluate_phase16.py),
FEATURE_PREFIX / SCORABLE_STATUSES / RANDOM_STATE / impute (evaluate.py),
per_race_metrics / bootstrap_gap (diagnose_phase10.py), flatten_samples
(evaluate_phase5.py).

Writes two files:
  results_phase19.json       — full per-period + pooled detail.
  final_model_selection.json — concise summary for the recommendation.

Run: python3 ml/evaluate_phase19.py
"""

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor

from evaluate import FEATURE_PREFIX, SCORABLE_STATUSES, RANDOM_STATE, impute, evaluate_scored_split
from evaluate_phase5 import flatten_samples
from evaluate_phase13 import (
    PERIODS, build_period_splits, lean_cols_for, RF_PARAMS_BY_STAGE, N_ESTIMATORS, load_dataset,
)
from evaluate_phase15 import PHASE14_WEIGHTS, select_weight, evaluate_with_score, shared_dnf_auc, GRID_COL
from evaluate_phase16 import variant_spec
from diagnose_phase10 import per_race_metrics, bootstrap_gap

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
RESULTS_PATH = ARTIFACT_DIR / "results_phase19.json"
FINAL_PATH = ARTIFACT_DIR / "final_model_selection.json"

CHAMP_COL = f"{FEATURE_PREFIX}championshipStandingScore"
POST_PARAMS = RF_PARAMS_BY_STAGE["post_qualifying"]
PRE_PARAMS = RF_PARAMS_BY_STAGE["pre_qualifying"]


def gap(train_m, val_m, test_m):
    def me(m):
        return m["meanPositionError"] if m and m.get("available") else None
    tr, va, te = me(train_m), me(val_m), me(test_m)
    return {
        "trainMeanPositionError": tr, "validationMeanPositionError": va, "testMeanPositionError": te,
        "trainValGap": (tr - va) if tr is not None and va is not None else None,
        "trainTestGap": (tr - te) if tr is not None and te is not None else None,
    }


def evaluate_pre_period(df, period):
    stage = "pre_qualifying"
    train_df, val_df, test_df = build_period_splits(df, stage, period)
    full_cols = lean_cols_for(train_df)
    medians = train_df[full_cols].median()
    train_imp = impute(train_df, full_cols, medians)
    val_imp = impute(val_df, full_cols, medians)
    test_imp = impute(test_df, full_cols, medians)
    train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]

    rf = RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1, **PRE_PARAMS)
    rf.fit(train_rows[full_cols].values, train_rows["outcome_finishPosition"].values.astype(float))
    rf_train, _ = evaluate_with_score(train_rows, rf.predict(train_rows[full_cols].values))
    rf_val, _ = evaluate_with_score(val_imp, rf.predict(val_imp[full_cols].values))
    rf_test_metrics, rf_test_scored = evaluate_with_score(test_imp, rf.predict(test_imp[full_cols].values))

    champ_test_metrics = evaluate_scored_split(test_imp, CHAMP_COL, ascending=False)

    dnf_auc = shared_dnf_auc(train_imp, test_imp, full_cols, PRE_PARAMS)

    return {
        "period": period["label"],
        "trainRaces": int(train_df[["season", "round"]].drop_duplicates().shape[0]),
        "valRaces": int(val_df[["season", "round"]].drop_duplicates().shape[0]),
        "testRaces": int(test_df[["season", "round"]].drop_duplicates().shape[0]),
        "models": {"championship_only": champ_test_metrics, "phase12_pre_rf": rf_test_metrics},
        "gaps": {"championship_only": None, "phase12_pre_rf": gap(rf_train, rf_val, rf_test_metrics)},
        "dnfAucSharedAcrossRfModels": dnf_auc,
        "_perRace": {
            "championship_only": per_race_metrics(test_imp, CHAMP_COL, ascending=False),
            "phase12_pre_rf": per_race_metrics(rf_test_scored, "_score", ascending=True),
        },
    }


def evaluate_post_period(df, period):
    stage = "post_qualifying"
    train_df, val_df, test_df = build_period_splits(df, stage, period)
    full_cols = lean_cols_for(train_df)
    medians = train_df[full_cols].median()
    train_imp = impute(train_df, full_cols, medians)
    val_imp = impute(val_df, full_cols, medians)
    test_imp = impute(test_df, full_cols, medians)
    train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]

    cols, mat_fn, extra_kwargs = variant_spec("core_subset", full_cols)
    rf = RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1, **POST_PARAMS, **extra_kwargs)
    rf.fit(mat_fn(train_rows), train_rows["outcome_finishPosition"].values.astype(float))

    grid_train = train_rows[GRID_COL].values.astype(float)
    grid_val = val_imp[GRID_COL].values.astype(float)
    grid_test = test_imp[GRID_COL].values.astype(float)
    rf_train_pred = rf.predict(mat_fn(train_rows))
    rf_val_pred = rf.predict(mat_fn(val_imp))
    rf_test_pred = rf.predict(mat_fn(test_imp))

    w, _ = select_weight(val_imp, grid_val, rf_val_pred, PHASE14_WEIGHTS)
    ens_train = w * grid_train + (1 - w) * rf_train_pred
    ens_val = w * grid_val + (1 - w) * rf_val_pred
    ens_test = w * grid_test + (1 - w) * rf_test_pred

    ens_train_m, _ = evaluate_with_score(train_rows, ens_train)
    ens_val_m, _ = evaluate_with_score(val_imp, ens_val)
    ens_test_m, ens_test_scored = evaluate_with_score(test_imp, ens_test)

    grid_test_m, grid_test_scored = evaluate_with_score(test_imp, grid_test)

    dnf_auc = shared_dnf_auc(train_imp, test_imp, full_cols, POST_PARAMS)

    return {
        "period": period["label"],
        "trainRaces": int(train_df[["season", "round"]].drop_duplicates().shape[0]),
        "valRaces": int(val_df[["season", "round"]].drop_duplicates().shape[0]),
        "testRaces": int(test_df[["season", "round"]].drop_duplicates().shape[0]),
        "ensembleWeightChosen": w,
        "models": {"grid_only": grid_test_m, "core_subset_ensemble": ens_test_m},
        "gaps": {"grid_only": None, "core_subset_ensemble": gap(ens_train_m, ens_val_m, ens_test_m)},
        "dnfAucSharedAcrossRfModels": dnf_auc,
        "_perRace": {
            "grid_only": per_race_metrics(grid_test_scored, "_score", ascending=True),
            "core_subset_ensemble": per_race_metrics(ens_test_scored, "_score", ascending=True),
        },
    }


def mean_std(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return {"mean": None, "std": None, "n": 0}
    return {"mean": float(np.mean(vals)), "std": float(np.std(vals)), "n": len(vals)}


def aggregate(period_results, model_names):
    out = {}
    for name in model_names:
        out[name] = {
            "winnerAccuracy": mean_std([r["models"][name].get("winnerAccuracy") for r in period_results]),
            "avgPodiumHitRate": mean_std([r["models"][name].get("avgPodiumHitRate") for r in period_results]),
            "avgTop5HitRate": mean_std([r["models"][name].get("avgTop5HitRate") for r in period_results]),
            "avgTop10HitRate": mean_std([r["models"][name].get("avgTop10HitRate") for r in period_results]),
            "meanPositionError": mean_std([r["models"][name].get("meanPositionError") for r in period_results]),
        }
    return out


def print_block(title, period_results, model_names):
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")
    for r in period_results:
        extra = f" ensembleW={r['ensembleWeightChosen']}" if "ensembleWeightChosen" in r else ""
        print(f"\n  {r['period']} (train={r['trainRaces']}, val={r['valRaces']}, test={r['testRaces']}){extra}")
        for name in model_names:
            m = r["models"][name]
            if m.get("available"):
                print(f"    {name:24s} winnerAcc={m['winnerAccuracy']:.3f} podium={m['avgPodiumHitRate']:.3f} "
                      f"top5={m['avgTop5HitRate']:.3f} top10={m['avgTop10HitRate']:.3f} meanPosErr={m['meanPositionError']:.3f}")
            g = r["gaps"].get(name)
            if g:
                print(f"      gap: train={g['trainMeanPositionError']:.3f} val={g['validationMeanPositionError']:.3f} "
                      f"test={g['testMeanPositionError']:.3f} trainValGap={g['trainValGap']:.3f} trainTestGap={g['trainTestGap']:.3f}")
        print(f"    dnfAuc (shared) = {r['dnfAucSharedAcrossRfModels']}")


