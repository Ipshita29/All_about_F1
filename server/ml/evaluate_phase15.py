#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 15 — VALIDATE ANCHORED MODELS
═══════════════════════════════════════════════════════════════════

Phase 14 showed that anchoring post-qualifying predictions to grid
position converts a statistically significant DEFICIT vs grid-only into
a (non-significant) edge. This phase does two things, both reusing the
Phase 13 rolling periods and the Phase 11 lean feature set:

  POST-QUALIFYING — re-test the grid-anchored ensemble with a finer
  weight grid (Phase 14 only tried 0.25/0.5/0.75) to see if a better
  weight exists, and compare it against grid-only, the plain Phase 12
  RF, and Phase 14's own ensemble (recomputed here with the identical
  pipeline/seed for a same-run comparison).

  PRE-QUALIFYING — test whether the SAME anchoring idea, applied to
  championship standing instead of grid position, fixes pre-qualifying's
  analogous problem (Phase 13: PRE RF showed no provable edge over the
  championship baseline). Championship score has no natural 1..N scale
  like grid position does, so it's first converted to a within-race RANK
  (1 = best standing) — this makes it directly comparable to the RF's
  predicted finish position for blending/residual purposes, exactly
  mirroring how grid position (already a natural rank) was used in
  Phase 14.

Weight candidates (grid/championship share of the blended score):
  0.1, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9
Tuned PER PERIOD on that period's own validation split only, never test.
Phase 14's narrower {0.25, 0.5, 0.75} search is also re-run here (same
pipeline, same seed) to give a fair same-run "phase14_ensemble" reference
point rather than importing its old numbers.

Reuses, never re-implements: PERIODS / build_period_splits / lean_cols_for
/ RF_PARAMS_BY_STAGE (evaluate_phase13.py), rank_within_race / evaluate_scored_split
/ impute / FEATURE_PREFIX / SCORABLE_STATUSES / RANDOM_STATE (evaluate.py),
per_race_metrics / bootstrap_gap (diagnose_phase10.py), flatten_samples /
did_finish (evaluate_phase5.py).

Run: python3 ml/evaluate_phase15.py
"""

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.metrics import roc_auc_score

from evaluate import (
    FEATURE_PREFIX, SCORABLE_STATUSES, RANDOM_STATE,
    impute, evaluate_scored_split, rank_within_race,
)
from evaluate_phase5 import flatten_samples, did_finish
from evaluate_phase13 import (
    PERIODS, build_period_splits, lean_cols_for, RF_PARAMS_BY_STAGE, N_ESTIMATORS, load_dataset,
)
from diagnose_phase10 import per_race_metrics, bootstrap_gap

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
RESULTS_PATH = ARTIFACT_DIR / "results_phase15.json"

GRID_COL = f"{FEATURE_PREFIX}gridPosition"
CHAMP_COL = f"{FEATURE_PREFIX}championshipStandingScore"

PHASE14_WEIGHTS = [0.25, 0.5, 0.75]
REFINED_WEIGHTS = [0.1, 0.2, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9]


def within_race_rank(df, score_col, ascending):
    return df.groupby(["season", "round"])[score_col].transform(
        lambda s: rank_within_race(s, ascending=ascending)
    )


def evaluate_with_score(d_imp, score_array):
    d = d_imp.copy()
    d["_score"] = score_array
    return evaluate_scored_split(d, "_score", ascending=True), d


def select_weight(val_imp, anchor_val, rf_val, weight_list):
    best_w, best_err, tried = None, None, {}
    for w in weight_list:
        combo = w * anchor_val + (1 - w) * rf_val
        metrics, _ = evaluate_with_score(val_imp, combo)
        err = metrics.get("meanPositionError")
        tried[w] = err
        if err is not None and (best_err is None or err < best_err):
            best_w, best_err = w, err
    return best_w, tried


def shared_dnf_auc(train_imp, test_imp, cols, params):
    for d in (train_imp, test_imp):
        if "target_didFinish" not in d.columns:
            d["target_didFinish"] = d["outcome_status"].apply(did_finish)
    train_dnf = train_imp[train_imp["target_didFinish"].notna()]
    test_dnf = test_imp[test_imp["target_didFinish"].notna()]
    if train_dnf["target_didFinish"].nunique() < 2:
        return None
    rf_dnf = RandomForestClassifier(
        n_estimators=N_ESTIMATORS, class_weight="balanced", random_state=RANDOM_STATE, n_jobs=-1, **params
    )
    rf_dnf.fit(train_dnf[cols].values, train_dnf["target_didFinish"].values.astype(int))
    y_test = test_dnf["target_didFinish"].values.astype(int)
    if len(set(y_test)) < 2:
        return None
    return float(roc_auc_score(y_test, rf_dnf.predict_proba(test_dnf[cols].values)[:, 1]))


# ---------------------------------------------------------------------------
# POST-QUALIFYING — grid-anchored ensemble, finer weight grid
# ---------------------------------------------------------------------------

def evaluate_post_period(df, period):
    stage = "post_qualifying"
    params = RF_PARAMS_BY_STAGE[stage]
    train_df, val_df, test_df = build_period_splits(df, stage, period)
    cols = lean_cols_for(train_df)
    medians = train_df[cols].median()
    train_imp = impute(train_df, cols, medians)
    val_imp = impute(val_df, cols, medians)
    test_imp = impute(test_df, cols, medians)
    train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]

    rf = RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1, **params)
    rf.fit(train_rows[cols].values, train_rows["outcome_finishPosition"].values.astype(float))

    grid_val = val_imp[GRID_COL].values.astype(float)
    rf_val = rf.predict(val_imp[cols].values)
    w14, search14 = select_weight(val_imp, grid_val, rf_val, PHASE14_WEIGHTS)
    w_refined, search_refined = select_weight(val_imp, grid_val, rf_val, REFINED_WEIGHTS)

    grid_test = test_imp[GRID_COL].values.astype(float)
    rf_test = rf.predict(test_imp[cols].values)
    train_score = rf.predict(train_rows[cols].values)

    models_scores = {
        "grid_only": grid_test,
        "phase12_rf": rf_test,
        "phase14_ensemble": w14 * grid_test + (1 - w14) * rf_test,
        "post_ensemble_refined": w_refined * grid_test + (1 - w_refined) * rf_test,
    }

    model_results, per_race_by_model = {}, {}
    for name, arr in models_scores.items():
        metrics, scored_df = evaluate_with_score(test_imp, arr)
        model_results[name] = metrics
        per_race_by_model[name] = per_race_metrics(scored_df, "_score", ascending=True)

    train_metrics, _ = evaluate_with_score(train_rows, train_score)
    train_test_gap = (
        train_metrics["meanPositionError"] - model_results["phase12_rf"]["meanPositionError"]
        if train_metrics.get("available") and model_results["phase12_rf"].get("available") else None
    )

    dnf_auc = shared_dnf_auc(train_imp, test_imp, cols, params)

    return {
        "period": period["label"],
        "trainRaces": int(train_df[["season", "round"]].drop_duplicates().shape[0]),
        "valRaces": int(val_df[["season", "round"]].drop_duplicates().shape[0]),
        "testRaces": int(test_df[["season", "round"]].drop_duplicates().shape[0]),
        "phase14WeightChosen": w14, "phase14WeightSearch": search14,
        "refinedWeightChosen": w_refined, "refinedWeightSearch": search_refined,
        "models": model_results,
        "phase12RfTrainTestGap": train_test_gap,
        "dnfAucSharedAcrossRfModels": dnf_auc,
        "_perRaceByModel": per_race_by_model,
    }


# ---------------------------------------------------------------------------
# PRE-QUALIFYING — championship-anchored ensemble & residual
# ---------------------------------------------------------------------------

def evaluate_pre_period(df, period):
    stage = "pre_qualifying"
    params = RF_PARAMS_BY_STAGE[stage]
    train_df, val_df, test_df = build_period_splits(df, stage, period)
    cols = lean_cols_for(train_df)
    medians = train_df[cols].median()
    train_imp = impute(train_df, cols, medians)
    val_imp = impute(val_df, cols, medians)
    test_imp = impute(test_df, cols, medians)
    train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]

    rf = RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1, **params)
    rf.fit(train_rows[cols].values, train_rows["outcome_finishPosition"].values.astype(float))

    # Championship score -> within-race rank (1 = best standing), the same
    # 1..N scale as finish position / grid position, so it can be blended
    # with the RF's predicted position exactly like Phase 14 blended grid.
    champ_rank_train_rows = within_race_rank(train_rows, CHAMP_COL, ascending=False)
    champ_rank_val = within_race_rank(val_imp, CHAMP_COL, ascending=False).values.astype(float)
    champ_rank_test = within_race_rank(test_imp, CHAMP_COL, ascending=False).values.astype(float)

    rf_val = rf.predict(val_imp[cols].values)
    w_chosen, weight_search = select_weight(val_imp, champ_rank_val, rf_val, REFINED_WEIGHTS)

    rf_test = rf.predict(test_imp[cols].values)
    train_score = rf.predict(train_rows[cols].values)

    # Championship-anchored residual: predict (finishPosition - champRank), add back.
    y_resid = train_rows["outcome_finishPosition"].values.astype(float) - champ_rank_train_rows.values.astype(float)
    rf_resid = RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1, **params)
    rf_resid.fit(train_rows[cols].values, y_resid)
    resid_test = champ_rank_test + rf_resid.predict(test_imp[cols].values)

    models_scores = {
        "phase12_pre_rf": rf_test,
        "championship_rf_ensemble": w_chosen * champ_rank_test + (1 - w_chosen) * rf_test,
        "championship_anchored_residual": resid_test,
    }

    model_results = {
        "championship_only": evaluate_scored_split(test_imp, CHAMP_COL, ascending=False),
    }
    per_race_by_model = {
        "championship_only": per_race_metrics(test_imp, CHAMP_COL, ascending=False),
    }
    for name, arr in models_scores.items():
        metrics, scored_df = evaluate_with_score(test_imp, arr)
        model_results[name] = metrics
        per_race_by_model[name] = per_race_metrics(scored_df, "_score", ascending=True)

    train_metrics, _ = evaluate_with_score(train_rows, train_score)
    train_test_gap = (
        train_metrics["meanPositionError"] - model_results["phase12_pre_rf"]["meanPositionError"]
        if train_metrics.get("available") and model_results["phase12_pre_rf"].get("available") else None
    )

    dnf_auc = shared_dnf_auc(train_imp, test_imp, cols, params)

    return {
        "period": period["label"],
        "trainRaces": int(train_df[["season", "round"]].drop_duplicates().shape[0]),
        "valRaces": int(val_df[["season", "round"]].drop_duplicates().shape[0]),
        "testRaces": int(test_df[["season", "round"]].drop_duplicates().shape[0]),
        "weightChosen": w_chosen, "weightSearch": weight_search,
        "models": model_results,
        "phase12RfTrainTestGap": train_test_gap,
        "dnfAucSharedAcrossRfModels": dnf_auc,
        "_perRaceByModel": per_race_by_model,
    }


def mean_std(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return {"mean": None, "std": None, "n": 0}
    return {"mean": float(np.mean(vals)), "std": float(np.std(vals)), "n": len(vals)}


def print_section(title, period_results, model_names):
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")
    for r in period_results:
        extra = ""
        if "phase14WeightChosen" in r:
            extra = f" phase14W={r['phase14WeightChosen']} refinedW={r['refinedWeightChosen']}"
        elif "weightChosen" in r:
            extra = f" championshipW={r['weightChosen']}"
        print(f"\n  {r['period']} (train={r['trainRaces']}, val={r['valRaces']}, test={r['testRaces']}){extra}")
        for name in model_names:
            m = r["models"][name]
            if m.get("available"):
                print(f"    {name:28s} winnerAcc={m['winnerAccuracy']:.3f} podium={m['avgPodiumHitRate']:.3f} "
                      f"top5={m['avgTop5HitRate']:.3f} top10={m['avgTop10HitRate']:.3f} meanPosErr={m['meanPositionError']:.3f}")
        print(f"    phase12RfTrainTestGap={r['phase12RfTrainTestGap']}  dnfAuc={r['dnfAucSharedAcrossRfModels']}")


def aggregate_and_bootstrap(period_results, model_names, baseline_name):
    aggregate = {}
    for name in model_names:
        aggregate[name] = {
            "winnerAccuracy": mean_std([r["models"][name].get("winnerAccuracy") for r in period_results]),
            "avgPodiumHitRate": mean_std([r["models"][name].get("avgPodiumHitRate") for r in period_results]),
            "avgTop5HitRate": mean_std([r["models"][name].get("avgTop5HitRate") for r in period_results]),
            "avgTop10HitRate": mean_std([r["models"][name].get("avgTop10HitRate") for r in period_results]),
            "meanPositionError": mean_std([r["models"][name].get("meanPositionError") for r in period_results]),
        }
    pooled_baseline = [race for r in period_results for race in r["_perRaceByModel"][baseline_name]]
    comparisons = {}
    for name in model_names:
        if name == baseline_name:
            continue
        pooled_model = [race for r in period_results for race in r["_perRaceByModel"][name]]
        comparisons[name] = bootstrap_gap(pooled_model, pooled_baseline)
    return aggregate, comparisons


