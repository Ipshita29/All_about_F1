#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 10 — MODEL & DATA BOTTLENECK DIAGNOSIS
═══════════════════════════════════════════════════════════════════

Phase 9 found the 9 OpenF1 features don't help. Rather than guessing at
a fix, this script runs 10 focused diagnostics against the EXISTING
Phase 2-5 dataset (dataset_phase5.json — deliberately NOT dataset_phase8,
no OpenF1 features anywhere in this file) and the existing trained-model
results, to find out what's ACTUALLY limiting performance before any
architectural change is made.

Every diagnostic reuses evaluate.py's own metric functions
(evaluate_race_group, aggregate_metrics, rank_within_race,
evaluate_scored_split) — never a second, different scoring rule. All
splits are the same chronological train=2023-24/validation=2025/
test=2026 used throughout; 2026 is read only for the final reported
numbers in sections 4-6 and 9, never for any selection or decision (the
learning-curve in section 10 and the overfitting check in section 5 are
evaluated on validation only where a decision is implied).

This file DIAGNOSES ONLY. It does not train a model for later use, does
not change predictorService.js/the live UI/F1 SignalR, and does not add
any feature or external API.

Run: python3 ml/diagnose_phase10.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance

from evaluate import (
    FEATURE_PREFIX, STAGES, SCORABLE_STATUSES, RANDOM_STATE,
    feature_columns_for, impute, evaluate_scored_split, evaluate_race_group, rank_within_race,
)
from evaluate_phase5 import flatten_samples

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
DATASET_PATH = ARTIFACT_DIR / "dataset_phase5.json"  # NOT phase8 — no OpenF1, per instruction
RESULTS_PHASE4_PATH = ARTIFACT_DIR / "results.json"
RESULTS_PHASE9_PATH = ARTIFACT_DIR / "results_phase9.json"
OUT_PATH = ARTIFACT_DIR / "results_phase10.json"

N_ESTIMATORS = 300  # same as Phase 4/5's own untuned default — keeps this diagnosis comparable to those reported numbers, not Phase 9's re-tuned ones


def load():
    with open(DATASET_PATH) as f:
        data = json.load(f)
    return data, flatten_samples(data["samples"])


def fit_rf(train_imp, cols):
    rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]
    model = RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1)
    model.fit(rows[cols].values, rows["outcome_finishPosition"].values.astype(float))
    return model, rows


def per_race_metrics(df_imp, score_col, ascending):
    results = []
    for (season, rnd), g in df_imp.groupby(["season", "round"]):
        g = g.copy()
        g["predictedPosition"] = rank_within_race(g[score_col], ascending=ascending)
        results.append({"season": season, "round": int(rnd), **evaluate_race_group(g.to_dict("records"))})
    return results


def stage_splits(df, stage):
    stage_df = df[df["stage"] == stage]
    train_df = stage_df[stage_df["split"] == "train"]
    val_df = stage_df[stage_df["split"] == "validation"]
    test_df = stage_df[stage_df["split"] == "test"]
    cols = feature_columns_for(train_df)
    medians = train_df[cols].median()
    return {
        "cols": cols,
        "train": impute(train_df, cols, medians),
        "validation": impute(val_df, cols, medians),
        "test": impute(test_df, cols, medians),
    }


# ---------------------------------------------------------------------------
# 1. Training-data size and season coverage
# ---------------------------------------------------------------------------

def section1(df):
    out = {}
    for stage in STAGES:
        stage_df = df[df["stage"] == stage]
        rows = {}
        for split in ["train", "validation", "test"]:
            sub = stage_df[stage_df["split"] == split]
            races = sub[["season", "round"]].drop_duplicates().shape[0]
            rows[split] = {
                "samples": int(len(sub)),
                "races": int(races),
                "classifiedRows": int(sub["outcome_classification"].isin(SCORABLE_STATUSES).sum()),
                "seasons": sorted(sub["season"].unique().tolist()),
            }
        out[stage] = rows
    return out


# ---------------------------------------------------------------------------
# 2. Feature redundancy / correlation (train split only — never peek at val/test for this)
# ---------------------------------------------------------------------------

def section2(df, stage):
    train_df = df[(df["stage"] == stage) & (df["split"] == "train")]
    cols = feature_columns_for(train_df)
    corr = train_df[cols].astype(float).corr()
    pairs = []
    for i, c1 in enumerate(cols):
        for c2 in cols[i + 1:]:
            r = corr.loc[c1, c2]
            if pd.notna(r) and abs(r) >= 0.7:
                pairs.append({"a": c1[len(FEATURE_PREFIX):], "b": c2[len(FEATURE_PREFIX):], "r": round(float(r), 3)})
    pairs.sort(key=lambda p: -abs(p["r"]))
    return pairs


# ---------------------------------------------------------------------------
# 3. Feature importance stability: train-fit .feature_importances_ vs
# out-of-sample permutation importance on validation
# ---------------------------------------------------------------------------

def section3(df, stage):
    s = stage_splits(df, stage)
    model, train_rows = fit_rf(s["train"], s["cols"])
    names = [c[len(FEATURE_PREFIX):] for c in s["cols"]]

    train_importance = sorted(zip(names, model.feature_importances_.tolist()), key=lambda x: -x[1])

    val_rows = s["validation"][s["validation"]["outcome_classification"].isin(SCORABLE_STATUSES)]
    perm = permutation_importance(
        model, val_rows[s["cols"]].values, val_rows["outcome_finishPosition"].values.astype(float),
        n_repeats=20, random_state=RANDOM_STATE, scoring="neg_mean_absolute_error",
    )
    val_importance = sorted(zip(names, perm.importances_mean.tolist()), key=lambda x: -x[1])

    top10_train = {n for n, _ in train_importance[:10]}
    top10_val = {n for n, _ in val_importance[:10]}
    return {
        "trainImportanceTop10": train_importance[:10],
        "validationPermutationImportanceTop10": val_importance[:10],
        "top10Overlap": len(top10_train & top10_val),
        "top10OverlapNames": sorted(top10_train & top10_val),
    }
