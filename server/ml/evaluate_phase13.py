#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 13 — ROLLING HISTORICAL EVALUATION
═══════════════════════════════════════════════════════════════════

Every phase from 9 onward kept landing on the same wall: a 14-race 2026
test set is too small for its CI to exclude zero on most comparisons.
This script doesn't add data or features — it reuses the EXISTING
dataset_phase5.json (no OpenF1, no new features, same lean lean columns
Phase 11/12 already settled on) and evaluates the SAME two fixed model
configurations Phase 12 chose across THREE pseudo-test periods instead
of one, using every season already in the dataset:

  Pseudo-test 2024: train/validation carved from 2023 ALONE (intra-season
                     split, first ~76% of rounds train / last ~24%
                     validation) — the only season strictly before 2024.
  Pseudo-test 2025: train=2023, validation=2024.
  Pseudo-test 2026: train=2023+2024, validation=2025 — this is exactly
                     the split every prior phase (4 through 12) already
                     used; its numbers here should reproduce those
                     exactly, which is itself a sanity check.

For every period, the test season is NEVER in that period's train or
validation data — enforced by construction (seasons are partitioned,
not sampled). The two RF configurations are FIXED, not re-tuned per
period (Phase 12 already chose them; this phase asks "do these settings
hold up across history", not "re-search per period"):
  PRE  RF: n_estimators=300, max_depth=None, min_samples_leaf=1  (Phase 12's
           own validation search chose the unconstrained tree for pre-qualifying)
  POST RF: n_estimators=300, max_depth=4,    min_samples_leaf=8  (Phase 12's
           chosen regularization for post-qualifying)

Reuses, never re-implements: REMOVED_FEATURES (evaluate_phase11.py),
metric functions (evaluate.py), per-race/bootstrap helpers
(diagnose_phase10.py), did_finish (evaluate_phase5.py).

The "existing predictor" baseline is only computable for the 2026
pseudo-test period, because that's the only season this project has
real captured production predictions for (existingPredictorPredictions
in the dataset export) — generating the equivalent for 2024/2025 would
require new Jolpica backtest calls, which this phase does not make
(scope discipline: evaluate the existing dataset, don't fetch more).

Run: python3 ml/evaluate_phase13.py
"""

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier

from evaluate import (
    FEATURE_PREFIX, STAGES, SCORABLE_STATUSES, RANDOM_STATE,
    feature_columns_for, impute, evaluate_scored_split, evaluate_existing_predictor,
)
from evaluate_phase5 import flatten_samples, did_finish
from evaluate_phase11 import REMOVED_FEATURES
from diagnose_phase10 import per_race_metrics, bootstrap_gap

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
DATASET_PATH = ARTIFACT_DIR / "dataset_phase5.json"  # NOT phase8 — no OpenF1
RESULTS_PATH = ARTIFACT_DIR / "results_phase13.json"

N_ESTIMATORS = 300
RF_PARAMS_BY_STAGE = {
    "pre_qualifying": {"max_depth": None, "min_samples_leaf": 1},
    "post_qualifying": {"max_depth": 4, "min_samples_leaf": 8},
}

INTRA_SEASON_TRAIN_FRACTION = 0.76  # ~16/21 rounds for the 2024 pseudo-test's only-prior-season split


def load_dataset():
    with open(DATASET_PATH) as f:
        return json.load(f)


def lean_cols_for(df_subset):
    full_cols = feature_columns_for(df_subset)
    return [c for c in full_cols if c[len(FEATURE_PREFIX):] not in REMOVED_FEATURES]


def season_rounds(df, season):
    return sorted(df[df["season"] == season]["round"].unique().tolist())


# ---------------------------------------------------------------------------
# Pseudo-test period definitions — every season already in the dataset,
# each only ever trained on seasons strictly before it.
# ---------------------------------------------------------------------------

PERIODS = [
    {"label": "2024", "testSeason": "2024", "mode": "intra_season_split", "trainSeason": "2023"},
    {"label": "2025", "testSeason": "2025", "mode": "season_split", "trainSeasons": ["2023"], "valSeason": "2024"},
    {"label": "2026", "testSeason": "2026", "mode": "season_split", "trainSeasons": ["2023", "2024"], "valSeason": "2025"},
]


def build_period_splits(df, stage, period):
    stage_df = df[df["stage"] == stage]
    test_df = stage_df[stage_df["season"] == period["testSeason"]]

    if period["mode"] == "intra_season_split":
        # Only one prior season exists (2023) — carve train/validation
        # chronologically WITHIN it, never touching the test season.
        rounds = season_rounds(stage_df, period["trainSeason"])
        cut = max(1, int(len(rounds) * INTRA_SEASON_TRAIN_FRACTION))
        train_rounds = set(rounds[:cut])
        val_rounds = set(rounds[cut:])
        season_df = stage_df[stage_df["season"] == period["trainSeason"]]
        train_df = season_df[season_df["round"].isin(train_rounds)]
        val_df = season_df[season_df["round"].isin(val_rounds)]
    else:
        train_df = stage_df[stage_df["season"].isin(period["trainSeasons"])]
        val_df = stage_df[stage_df["season"] == period["valSeason"]]

    return train_df, val_df, test_df


# ---------------------------------------------------------------------------
# One pseudo-test period, one stage — fixed RF config (no re-tuning),
# fit on that period's own train split, scored on train/validation/test.
# ---------------------------------------------------------------------------

def evaluate_period(df, stage, period, existing_predictor_2026):
    train_df, val_df, test_df = build_period_splits(df, stage, period)
    cols = lean_cols_for(train_df)
    medians = train_df[cols].median()
    train_imp = impute(train_df, cols, medians)
    val_imp = impute(val_df, cols, medians)
    test_imp = impute(test_df, cols, medians)

    train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]
    params = RF_PARAMS_BY_STAGE[stage]

    rf = RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1, **params)
    rf.fit(train_rows[cols].values, train_rows["outcome_finishPosition"].values.astype(float))

    def scored(split_imp):
        split_imp = split_imp.copy()
        split_imp["_score"] = rf.predict(split_imp[cols].values)
        return evaluate_scored_split(split_imp, "_score", ascending=True)

    train_metrics = scored(train_imp)
    val_metrics = scored(val_imp)
    test_metrics = scored(test_imp)
    test_per_race = per_race_metrics(test_imp.assign(_score=rf.predict(test_imp[cols].values)), "_score", ascending=True)

    # ---- DNF classifier, same fixed capacity settings ----
    for d in (train_imp, test_imp):
        if "target_didFinish" not in d.columns:
            d["target_didFinish"] = d["outcome_status"].apply(did_finish)
    train_dnf = train_imp[train_imp["target_didFinish"].notna()]
    test_dnf = test_imp[test_imp["target_didFinish"].notna()]
    dnf_auc = None
    if train_dnf["target_didFinish"].nunique() >= 2:
        rf_dnf = RandomForestClassifier(n_estimators=N_ESTIMATORS, class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1, **params)
        rf_dnf.fit(train_dnf[cols].values, train_dnf["target_didFinish"].values.astype(int))
        y_test = test_dnf["target_didFinish"].values.astype(int)
        if len(set(y_test)) >= 2:
            from sklearn.metrics import roc_auc_score
            dnf_auc = float(roc_auc_score(y_test, rf_dnf.predict_proba(test_dnf[cols].values)[:, 1]))

    # ---- Baselines (feature-set independent) ----
    baselines = {}
    champ_col = f"{FEATURE_PREFIX}championshipStandingScore"
    if champ_col in test_imp.columns:
        baselines["championship"] = {
            "test": evaluate_scored_split(test_imp, champ_col, ascending=False),
            "perRace": per_race_metrics(test_imp, champ_col, ascending=False),
        }
    grid_col = f"{FEATURE_PREFIX}gridPosition"
    if stage == "post_qualifying" and grid_col in test_imp.columns:
        baselines["grid"] = {
            "test": evaluate_scored_split(test_imp, grid_col, ascending=True),
            "perRace": per_race_metrics(test_imp, grid_col, ascending=True),
        }
        if period["testSeason"] == "2026" and existing_predictor_2026 is not None:
            baselines["existing_predictor"] = {"test": evaluate_existing_predictor(test_df, existing_predictor_2026)}

    return {
        "period": period["label"],
        "trainRows": int(len(train_rows)),
        "trainRaces": int(train_df[["season", "round"]].drop_duplicates().shape[0]),
        "valRaces": int(val_df[["season", "round"]].drop_duplicates().shape[0]),
        "testRaces": int(test_df[["season", "round"]].drop_duplicates().shape[0]),
        "featureCount": len(cols),
        "params": params,
        "train": train_metrics,
        "validation": val_metrics,
        "test": test_metrics,
        "trainTestGap": (train_metrics["meanPositionError"] - test_metrics["meanPositionError"]) if train_metrics.get("available") and test_metrics.get("available") else None,
        "dnfAuc": dnf_auc,
        "baselines": baselines,
        "_testPerRace": test_per_race,  # kept for pooled bootstrap, stripped before final JSON write
    }


def mean_std(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return {"mean": None, "std": None, "n": 0}
    return {"mean": float(np.mean(vals)), "std": float(np.std(vals)), "n": len(vals)}


