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


# ---------------------------------------------------------------------------
# 4. Performance by season/race (per-race breakdown within validation & test)
# ---------------------------------------------------------------------------

def section4(df, stage):
    s = stage_splits(df, stage)
    model, _ = fit_rf(s["train"], s["cols"])

    def scored(split_imp):
        split_imp = split_imp.copy()
        split_imp["_score"] = model.predict(split_imp[s["cols"]].values)
        return per_race_metrics(split_imp, "_score", ascending=True)

    return {"validationPerRace": scored(s["validation"]), "testPerRace": scored(s["test"])}, s, model


# ---------------------------------------------------------------------------
# 5. Overfitting check — same model evaluated on train / validation / test
# ---------------------------------------------------------------------------

def section5(s, model):
    def scored(split_imp):
        split_imp = split_imp.copy()
        split_imp["_score"] = model.predict(split_imp[s["cols"]].values)
        return evaluate_scored_split(split_imp, "_score", ascending=True)

    return {"train": scored(s["train"]), "validation": scored(s["validation"]), "test": scored(s["test"])}


# ---------------------------------------------------------------------------
# 6. Winner calibration — when the model is wrong, how wrong? And where does
# the real winner usually rank in the model's own order?
# ---------------------------------------------------------------------------

def section6(s, model):
    test_scored = s["test"].copy()
    test_scored["_score"] = model.predict(test_scored[s["cols"]].values)

    actual_pos_of_predicted_winner = []
    predicted_pos_of_actual_winner = []
    for (_, _), g in test_scored.groupby(["season", "round"]):
        g = g.copy()
        g["predictedPosition"] = rank_within_race(g["_score"], ascending=True)
        pred_winner = g[g["predictedPosition"] == 1]
        if len(pred_winner) and pred_winner.iloc[0]["outcome_classification"] in SCORABLE_STATUSES:
            actual_pos_of_predicted_winner.append(int(pred_winner.iloc[0]["outcome_finishPosition"]))
        actual_winner = g[(g["outcome_finishPosition"] == 1) & (g["outcome_classification"].isin(SCORABLE_STATUSES))]
        if len(actual_winner):
            predicted_pos_of_actual_winner.append(int(actual_winner.iloc[0]["predictedPosition"]))

    return {
        "actualPositionOfPredictedWinner": actual_pos_of_predicted_winner,
        "predictedPositionOfActualWinner": predicted_pos_of_actual_winner,
        "meanActualPosOfPredictedWinner": float(np.mean(actual_pos_of_predicted_winner)) if actual_pos_of_predicted_winner else None,
        "meanPredictedPosOfActualWinner": float(np.mean(predicted_pos_of_actual_winner)) if predicted_pos_of_actual_winner else None,
    }


# ---------------------------------------------------------------------------
# 7. Target formulation — pull from ALREADY-REPORTED Phase 5/9 results
# (winner-classifier LR vs finishPosition-regression RF/GB on winnerAccuracy
# specifically) rather than refitting, since those numbers already exist
# and are directly comparable.
# ---------------------------------------------------------------------------

def section7():
    with open(RESULTS_PHASE9_PATH) as f:
        p9 = json.load(f)
    out = {}
    for stage, stage_report in p9["stages"].items():
        variant = stage_report["without_openf1"]  # pure Phase 4/5 feature set, no OpenF1
        out[stage] = {
            "regression_based_ranking": {
                "random_forest_winnerAcc": variant["random_forest"]["test"].get("winnerAccuracy"),
                "gradient_boosting_winnerAcc": variant["gradient_boosting"]["test"].get("winnerAccuracy"),
            },
            "direct_binary_winner_classifier": {
                "logistic_regression_winnerAcc": variant["logistic_regression"]["test"].get("winnerAccuracy"),
            },
        }
    return out


# ---------------------------------------------------------------------------
# 8. Do DNF-heavy races hurt finishPosition accuracy for the surviving field?
# (evidence for/against a separate DNF-aware model being genuinely useful)
# ---------------------------------------------------------------------------

def section8(df, stage, test_per_race):
    test_df = df[(df["stage"] == stage) & (df["split"] == "test")]
    dnf_count_by_race = (
        test_df[~test_df["outcome_classification"].isin(SCORABLE_STATUSES)]
        .groupby(["season", "round"]).size()
    )
    dnf_map = {f"{s}|{r}": int(c) for (s, r), c in dnf_count_by_race.items()}

    enriched = []
    for r in test_per_race:
        key = f"{r['season']}|{r['round']}"
        enriched.append({**r, "dnfCount": dnf_map.get(key, 0)})

    counts = [r["dnfCount"] for r in enriched]
    med = float(np.median(counts)) if counts else 0
    high = [r for r in enriched if r["dnfCount"] > med]
    low = [r for r in enriched if r["dnfCount"] <= med]

    def avg_err(group):
        vals = [r["meanPositionError"] for r in group if r["meanPositionError"] is not None]
        return float(np.mean(vals)) if vals else None

    return {
        "medianDnfCountPerRace": med,
        "highDnfRaces": {"n": len(high), "avgMeanPositionError": avg_err(high)},
        "lowDnfRaces": {"n": len(low), "avgMeanPositionError": avg_err(low)},
        "perRaceDnfCounts": enriched,
    }


# ---------------------------------------------------------------------------
# 9. Baseline vs ML — is the gap real, or noise from 14 test races?
# Bootstrap the SET OF RACES (not rows) to get a 95% CI on the gap.
# ---------------------------------------------------------------------------

def bootstrap_gap(per_race_a, per_race_b, metric="meanPositionError", n_boot=5000):
    a_map = {(r["season"], r["round"]): r[metric] for r in per_race_a if r.get(metric) is not None}
    b_map = {(r["season"], r["round"]): r[metric] for r in per_race_b if r.get(metric) is not None}
    common = sorted(set(a_map) & set(b_map))
    if not common:
        return {"available": False}
    diffs = np.array([a_map[k] - b_map[k] for k in common])  # a - b; negative = a (model) better than b (baseline)
    n = len(diffs)
    rng = np.random.default_rng(RANDOM_STATE)
    boot_means = np.array([diffs[rng.integers(0, n, n)].mean() for _ in range(n_boot)])
    ci_low, ci_high = np.percentile(boot_means, [2.5, 97.5])
    return {
        "available": True, "nRaces": n, "meanDiff": float(diffs.mean()),
        "ci95": [float(ci_low), float(ci_high)], "ciExcludesZero": bool(ci_low > 0 or ci_high < 0),
    }


def section9(s, model, test_per_race):
    champ_per_race = per_race_metrics(s["test"], f"{FEATURE_PREFIX}championshipStandingScore", ascending=False)
    out = {"random_forest_vs_championship_baseline": bootstrap_gap(test_per_race, champ_per_race)}
    if f"{FEATURE_PREFIX}gridPosition" in s["test"].columns:
        grid_per_race = per_race_metrics(s["test"], f"{FEATURE_PREFIX}gridPosition", ascending=True)
        out["random_forest_vs_grid_baseline"] = bootstrap_gap(test_per_race, grid_per_race)
    return out


# ---------------------------------------------------------------------------
# 10. Learning curve — does MORE of our existing training data help, before
# assuming we need to go fetch even more?
# ---------------------------------------------------------------------------

def section10(df, stage):
    stage_df = df[df["stage"] == stage]
    val_df = stage_df[stage_df["split"] == "validation"]
    results = {}
    for label, seasons in [("2024_only", ["2024"]), ("2023_and_2024", ["2023", "2024"])]:
        train_subset = stage_df[(stage_df["split"] == "train") & (stage_df["season"].isin(seasons))]
        cols = feature_columns_for(train_subset)
        medians = train_subset[cols].median()
        train_imp = impute(train_subset, cols, medians)
        val_imp = impute(val_df, cols, medians)
        model, train_rows = fit_rf(train_imp, cols)
        val_scored = val_imp.copy()
        val_scored["_score"] = model.predict(val_imp[cols].values)
        results[label] = {
            "trainRows": int(len(train_rows)),
            "trainRaces": int(train_subset[["season", "round"]].drop_duplicates().shape[0]),
            "validationMetrics": evaluate_scored_split(val_scored, "_score", ascending=True),
        }
    return results
