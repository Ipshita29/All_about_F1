#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 16 — IMPROVE POST ANCHORED MODEL
═══════════════════════════════════════════════════════════════════

Phase 14/15 established the grid-anchored ensemble (score = w*grid +
(1-w)*RF, w from {0.25, 0.5, 0.75}, tuned per period on validation only)
as the best post-qualifying candidate so far — it neutralizes the plain
Phase 12 RF's proven significant deficit vs grid-only, though it doesn't
yet beat grid-only significantly either. Phase 15 also showed that
widening the ensemble weight search makes things WORSE (overfits small
validation folds), so this phase does not touch the weight search again.

This phase asks a narrower, deliberately conservative question: does the
"RF" half of that ensemble add more value if it's built from a smaller,
hand-picked set of already-identified core signals instead of the full
27-column lean feature set? Four RF-component variants, same grid-anchor
ensemble wrapper around every one of them, same {0.25, 0.5, 0.75} weight
search, same 2024/2025/2026 rolling periods, same lean dataset:

  1. phase14_full_lean   — unchanged: all Phase 11 lean columns (the
                            existing Phase 14 ensemble, re-run here for a
                            same-pipeline comparison point).
  2. core_subset          — a hand-picked ~10-column subset covering the
                             five signal families the task names
                             (championship standing, constructor recent
                             qualifying pace, recent form, teammate
                             comparison, reliability) plus grid/qualifying
                             position.
  3. reweighted_full       — the FULL lean set, but the same core columns
                             (minus grid, which is the ensemble's own
                             anchor) are replicated 3x with
                             max_features="sqrt" — the same replication
                             trick Phase 14 used to bias RF splits toward
                             grid, applied here to the core signal family
                             instead, without discarding any feature.
  4. minimal_core          — an even smaller, 6-column set: exactly one
                             feature per named signal family plus grid.

No new data, no new features, no new targets, no change to the PRE
architecture, no production/F1 SignalR changes. Deliberately NOT doing:
a feature-subset search, a finer ensemble-weight grid, or per-variant
hyperparameter tuning beyond this one fixed set of four variants — Phase
15's finding that small validation folds punish fine-grained search
applies here too.

Reuses, never re-implements: PERIODS / build_period_splits / lean_cols_for
/ RF_PARAMS_BY_STAGE / N_ESTIMATORS / load_dataset (evaluate_phase13.py),
PHASE14_WEIGHTS / select_weight / evaluate_with_score / shared_dnf_auc /
GRID_COL (evaluate_phase15.py), metric functions (evaluate.py), per-race /
bootstrap helpers (diagnose_phase10.py), flatten_samples (evaluate_phase5.py).

Run: python3 ml/evaluate_phase16.py
"""

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor

from evaluate import FEATURE_PREFIX, SCORABLE_STATUSES, RANDOM_STATE, impute
from evaluate_phase5 import flatten_samples
from evaluate_phase13 import (
    PERIODS, build_period_splits, lean_cols_for, RF_PARAMS_BY_STAGE, N_ESTIMATORS, load_dataset,
)
from evaluate_phase15 import PHASE14_WEIGHTS, select_weight, evaluate_with_score, shared_dnf_auc, GRID_COL
from diagnose_phase10 import per_race_metrics, bootstrap_gap

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
RESULTS_PATH = ARTIFACT_DIR / "results_phase16.json"

STAGE = "post_qualifying"
POST_PARAMS = RF_PARAMS_BY_STAGE[STAGE]
REPLICATION_FACTOR = 3

# ---------------------------------------------------------------------------
# Core signal families named in the task, mapped to the actual Phase 11 lean
# columns that survived the Phase 10/11 correlation pruning.
# ---------------------------------------------------------------------------

CORE_SUBSET_COLS = [
    f"{FEATURE_PREFIX}championshipStandingScore",      # championship standing
    f"{FEATURE_PREFIX}constructorRecentQualifyingAvgLast5",  # constructor recent qualifying
    f"{FEATURE_PREFIX}avgPointsLast5",                  # recent form
    f"{FEATURE_PREFIX}recentFinishingTrend",            # recent form (trend variant)
    f"{FEATURE_PREFIX}teammateQualifyingDelta",         # teammate performance
    f"{FEATURE_PREFIX}teammateRaceDelta",               # teammate performance
    f"{FEATURE_PREFIX}driverDnfRate",                   # reliability
    f"{FEATURE_PREFIX}constructorDnfRate",              # reliability
    f"{FEATURE_PREFIX}gridPosition",
    f"{FEATURE_PREFIX}qualifyingPosition",
]

MINIMAL_CORE_COLS = [
    f"{FEATURE_PREFIX}championshipStandingScore",
    f"{FEATURE_PREFIX}constructorRecentQualifyingAvgLast5",
    f"{FEATURE_PREFIX}avgPointsLast5",
    f"{FEATURE_PREFIX}teammateQualifyingDelta",
    f"{FEATURE_PREFIX}driverDnfRate",
    f"{FEATURE_PREFIX}gridPosition",
]

REWEIGHT_CORE_COLS = [
    f"{FEATURE_PREFIX}championshipStandingScore",
    f"{FEATURE_PREFIX}constructorRecentQualifyingAvgLast5",
    f"{FEATURE_PREFIX}avgPointsLast5",
    f"{FEATURE_PREFIX}recentFinishingTrend",
    f"{FEATURE_PREFIX}teammateQualifyingDelta",
    f"{FEATURE_PREFIX}teammateRaceDelta",
    f"{FEATURE_PREFIX}driverDnfRate",
    f"{FEATURE_PREFIX}constructorDnfRate",
]

VARIANT_NAMES = ["phase14_full_lean", "core_subset", "reweighted_full", "minimal_core"]


def variant_spec(name, full_cols):
    """Returns (model_cols_for_reporting, matrix_fn, rf_extra_kwargs)."""
    if name == "phase14_full_lean":
        cols = full_cols
        return cols, (lambda d: d[cols].values), {}
    if name == "core_subset":
        cols = [c for c in CORE_SUBSET_COLS if c in full_cols]
        return cols, (lambda d: d[cols].values), {}
    if name == "minimal_core":
        cols = [c for c in MINIMAL_CORE_COLS if c in full_cols]
        return cols, (lambda d: d[cols].values), {}
    if name == "reweighted_full":
        cols = full_cols
        rep_cols = [c for c in REWEIGHT_CORE_COLS if c in full_cols]

        def mat(d):
            base = d[cols].values
            rep_block = np.repeat(d[rep_cols].values, REPLICATION_FACTOR, axis=1)
            return np.hstack([base, rep_block])

        return cols, mat, {"max_features": "sqrt"}
    raise ValueError(name)


def evaluate_period(df, period):
    train_df, val_df, test_df = build_period_splits(df, STAGE, period)
    full_cols = lean_cols_for(train_df)
    medians = train_df[full_cols].median()
    train_imp = impute(train_df, full_cols, medians)
    val_imp = impute(val_df, full_cols, medians)
    test_imp = impute(test_df, full_cols, medians)
    train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]

    grid_val = val_imp[GRID_COL].values.astype(float)
    grid_test = test_imp[GRID_COL].values.astype(float)

    model_results, per_race_by_model, weights_chosen, train_test_gaps = {}, {}, {}, {}

    for name in VARIANT_NAMES:
        cols, mat_fn, extra_kwargs = variant_spec(name, full_cols)
        rf = RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1, **POST_PARAMS, **extra_kwargs)
        rf.fit(mat_fn(train_rows), train_rows["outcome_finishPosition"].values.astype(float))

        rf_val = rf.predict(mat_fn(val_imp))
        w, _search = select_weight(val_imp, grid_val, rf_val, PHASE14_WEIGHTS)
        weights_chosen[name] = w

        rf_test = rf.predict(mat_fn(test_imp))
        rf_train = rf.predict(mat_fn(train_rows))
        ensemble_test = w * grid_test + (1 - w) * rf_test

        metrics, scored_df = evaluate_with_score(test_imp, ensemble_test)
        model_results[name] = metrics
        per_race_by_model[name] = per_race_metrics(scored_df, "_score", ascending=True)

        rf_train_metrics, _ = evaluate_with_score(train_rows, rf_train)
        rf_test_metrics, _ = evaluate_with_score(test_imp, rf_test)
        train_test_gaps[name] = (
            rf_train_metrics["meanPositionError"] - rf_test_metrics["meanPositionError"]
            if rf_train_metrics.get("available") and rf_test_metrics.get("available") else None
        )

    # grid-only reference, same as every prior phase
    grid_metrics, grid_scored = evaluate_with_score(test_imp, grid_test)
    model_results["grid_only"] = grid_metrics
    per_race_by_model["grid_only"] = per_race_metrics(grid_scored, "_score", ascending=True)

    dnf_auc = shared_dnf_auc(train_imp, test_imp, full_cols, POST_PARAMS)

    return {
        "period": period["label"],
        "trainRaces": int(train_df[["season", "round"]].drop_duplicates().shape[0]),
        "valRaces": int(val_df[["season", "round"]].drop_duplicates().shape[0]),
        "testRaces": int(test_df[["season", "round"]].drop_duplicates().shape[0]),
        "weightsChosen": weights_chosen,
        "models": model_results,
        "rfComponentTrainTestGap": train_test_gaps,
        "dnfAucSharedAcrossVariants": dnf_auc,
        "_perRaceByModel": per_race_by_model,
    }


def mean_std(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return {"mean": None, "std": None, "n": 0}
    return {"mean": float(np.mean(vals)), "std": float(np.std(vals)), "n": len(vals)}


def main():
    data = load_dataset()
    df = flatten_samples(data["samples"])

    print("=" * 78)
    print("PHASE 16 — IMPROVE POST ANCHORED MODEL")
    print("=" * 78)
    print(f"Core subset: {CORE_SUBSET_COLS}")
    print(f"Minimal core: {MINIMAL_CORE_COLS}")
    print(f"Reweight core (x{REPLICATION_FACTOR}): {REWEIGHT_CORE_COLS}")

    period_results = [evaluate_period(df, p) for p in PERIODS]
    all_models = VARIANT_NAMES + ["grid_only"]

    print("\n--- Per-period test performance ---")
    for r in period_results:
        print(f"\n  {r['period']} (train={r['trainRaces']}, val={r['valRaces']}, test={r['testRaces']}) "
              f"weights={r['weightsChosen']}")
        for name in all_models:
            m = r["models"][name]
            if m.get("available"):
                print(f"    {name:20s} winnerAcc={m['winnerAccuracy']:.3f} podium={m['avgPodiumHitRate']:.3f} "
                      f"top5={m['avgTop5HitRate']:.3f} top10={m['avgTop10HitRate']:.3f} meanPosErr={m['meanPositionError']:.3f}")
        print(f"    rfComponentTrainTestGap={r['rfComponentTrainTestGap']}")
        print(f"    dnfAuc (shared)={r['dnfAucSharedAcrossVariants']}")

    print("\n--- Aggregate (mean +/- std across periods) ---")
    aggregate = {}
    for name in all_models:
        aggregate[name] = {
            "winnerAccuracy": mean_std([r["models"][name].get("winnerAccuracy") for r in period_results]),
            "avgPodiumHitRate": mean_std([r["models"][name].get("avgPodiumHitRate") for r in period_results]),
            "avgTop5HitRate": mean_std([r["models"][name].get("avgTop5HitRate") for r in period_results]),
            "avgTop10HitRate": mean_std([r["models"][name].get("avgTop10HitRate") for r in period_results]),
            "meanPositionError": mean_std([r["models"][name].get("meanPositionError") for r in period_results]),
        }
        a = aggregate[name]
        print(f"  {name:20s} meanPosErr={a['meanPositionError']['mean']:.3f} +/- {a['meanPositionError']['std']:.3f}  "
              f"winnerAcc={a['winnerAccuracy']['mean']:.3f} +/- {a['winnerAccuracy']['std']:.3f}")

    print("\n--- Pooled bootstrap vs grid-only (60 races) ---")
    pooled_grid = [race for r in period_results for race in r["_perRaceByModel"]["grid_only"]]
    comparisons = {}
    for name in VARIANT_NAMES:
        pooled_model = [race for r in period_results for race in r["_perRaceByModel"][name]]
        comp = bootstrap_gap(pooled_model, pooled_grid)
        comparisons[name] = comp
        if comp.get("available"):
            print(f"  {name:20s} meanDiff={comp['meanDiff']:+.3f} 95% CI=[{comp['ci95'][0]:+.3f}, {comp['ci95'][1]:+.3f}] "
                  f"excludesZero={comp['ciExcludesZero']}")

    for r in period_results:
        del r["_perRaceByModel"]

    report = {
        "stage": STAGE,
        "replicationFactor": REPLICATION_FACTOR,
        "coreSubsetCols": CORE_SUBSET_COLS,
        "minimalCoreCols": MINIMAL_CORE_COLS,
        "reweightCoreCols": REWEIGHT_CORE_COLS,
        "periods": period_results,
        "aggregate": aggregate,
        "vsGridOnlyPooledBootstrap": comparisons,
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\nFull results written to {RESULTS_PATH}")


if __name__ == "__main__":
    main()
