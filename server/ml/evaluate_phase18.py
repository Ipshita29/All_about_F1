#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 18 — VOLATILITY-CONDITIONAL ENSEMBLE
═══════════════════════════════════════════════════════════════════

Phase 17 found a volatility axis: the grid-anchored ensemble beats
grid-only on big movers (large actual position swings), back-of-grid
starters, and high-DNF races, but LOSES to grid-only on "stable" races
and three specific chaotic circuits. Every ensemble through Phase 16
used ONE fixed weight for an entire race. This phase tests the
mechanism that finding actually implies: a PER-SAMPLE weight driven by
a simple volatility signal, so the ensemble leans on the RF only when
a driver looks volatile and leans on grid otherwise.

  prediction = w(volatility) * grid + (1 - w(volatility)) * RF

Volatility signal (built ONLY from existing Phase 11 lean columns, no
new data/features):
  reliability   = mean(driverDnfRate, constructorDnfRate)
  teammateDelta = mean(|teammateQualifyingDelta|, |teammateRaceDelta|)
  formSwing     = |recentFinishingTrend|
  volatility    = mean of the three, each min-max scaled using TRAIN-
                  split bounds only (no leakage), averaged equally —
                  deliberately a plain unweighted average, not a
                  learned combination, to keep the mechanism simple
                  and interpretable as the task requires.

Each period's train split also fixes that period's tertile cutpoints
(low/medium/high volatility); validation and test buckets reuse those
same train-fit cutpoints. The per-bucket weight (one of exactly three
coarse candidates {0.25, 0.5, 0.75} per bucket, so 27 combinations
total) is chosen by a small grid search on that period's OWN validation
split only — never on test. This both answers "performance by
volatility bucket" and supplies the per-sample weight at test time.

Three models compared, all post-qualifying, all on the Phase 11 lean
feature set, all using the same core_subset RF component Phase 16
tentatively adopted as the reference:
  1. grid_only              — unchanged baseline.
  2. fixed_ensemble         — Phase 14/16's single period-wide weight
                              (re-selected here from {0.25,0.5,0.75} on
                              this run's own validation split, for a
                              fair same-pipeline comparison).
  3. volatility_conditional — the per-sample-weighted ensemble above.

No new data, no new features, no new targets, no PRE changes, no
production/F1 SignalR changes. The weight search stays a 27-point grid
(3 buckets x 3 coarse candidates) — deliberately not a continuous or
finer search, per Phase 15's finding that finer searches overfit small
validation folds.

Reuses, never re-implements: PERIODS / build_period_splits / lean_cols_for
/ RF_PARAMS_BY_STAGE / N_ESTIMATORS / load_dataset (evaluate_phase13.py),
PHASE14_WEIGHTS / select_weight / evaluate_with_score / shared_dnf_auc /
GRID_COL (evaluate_phase15.py), variant_spec (evaluate_phase16.py),
rank_within_race / SCORABLE_STATUSES / FEATURE_PREFIX / RANDOM_STATE /
impute (evaluate.py), per_race_metrics / bootstrap_gap (diagnose_phase10.py).

Run: python3 ml/evaluate_phase18.py
"""

import itertools
import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor

from evaluate import FEATURE_PREFIX, SCORABLE_STATUSES, RANDOM_STATE, impute, rank_within_race
from evaluate_phase5 import flatten_samples
from evaluate_phase13 import (
    PERIODS, build_period_splits, lean_cols_for, RF_PARAMS_BY_STAGE, N_ESTIMATORS, load_dataset,
)
from evaluate_phase15 import PHASE14_WEIGHTS, select_weight, evaluate_with_score, shared_dnf_auc, GRID_COL
from evaluate_phase16 import variant_spec
from diagnose_phase10 import per_race_metrics, bootstrap_gap

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
RESULTS_PATH = ARTIFACT_DIR / "results_phase18.json"

STAGE = "post_qualifying"
POST_PARAMS = RF_PARAMS_BY_STAGE[STAGE]
RF_VARIANT = "core_subset"  # Phase 16's tentative reference

VOL_COLS = {
    "driverDnf": f"{FEATURE_PREFIX}driverDnfRate",
    "constructorDnf": f"{FEATURE_PREFIX}constructorDnfRate",
    "teammateQ": f"{FEATURE_PREFIX}teammateQualifyingDelta",
    "teammateR": f"{FEATURE_PREFIX}teammateRaceDelta",
    "trend": f"{FEATURE_PREFIX}recentFinishingTrend",
}

BUCKET_LABELS = ["low", "medium", "high"]
WEIGHT_CANDIDATES = PHASE14_WEIGHTS  # {0.25, 0.5, 0.75} — same coarse set as every prior phase


def raw_volatility_components(d):
    rel = (d[VOL_COLS["driverDnf"]].values.astype(float) + d[VOL_COLS["constructorDnf"]].values.astype(float)) / 2
    teammate_mag = (np.abs(d[VOL_COLS["teammateQ"]].values.astype(float)) + np.abs(d[VOL_COLS["teammateR"]].values.astype(float))) / 2
    form_swing = np.abs(d[VOL_COLS["trend"]].values.astype(float))
    return rel, teammate_mag, form_swing


def fit_volatility_scaler(train_imp):
    rel, team, form = raw_volatility_components(train_imp)
    scalers = {}
    for name, vals in [("rel", rel), ("team", team), ("form", form)]:
        lo, hi = float(np.min(vals)), float(np.max(vals))
        scalers[name] = (lo, hi - lo if hi > lo else 1.0)
    return scalers


def volatility_score(d, scalers):
    rel, team, form = raw_volatility_components(d)

    def scale(vals, key):
        lo, span = scalers[key]
        return np.clip((vals - lo) / span, 0, 1)

    return (scale(rel, "rel") + scale(team, "team") + scale(form, "form")) / 3


def fit_volatility_buckets(train_imp):
    scalers = fit_volatility_scaler(train_imp)
    scores = volatility_score(train_imp, scalers)
    q1, q2 = np.quantile(scores, [1 / 3, 2 / 3])
    return scalers, (float(q1), float(q2))


def bucket_from_score(scores, cutpoints):
    q1, q2 = cutpoints
    return np.where(scores <= q1, "low", np.where(scores <= q2, "medium", "high"))


def select_bucket_weights(val_imp, bucket_val, grid_val, rf_val):
    best_combo, best_err = None, None
    for combo in itertools.product(WEIGHT_CANDIDATES, repeat=3):
        w_map = dict(zip(BUCKET_LABELS, combo))
        w_per_sample = np.array([w_map[b] for b in bucket_val])
        combined = w_per_sample * grid_val + (1 - w_per_sample) * rf_val
        metrics, _ = evaluate_with_score(val_imp, combined)
        err = metrics.get("meanPositionError")
        if err is not None and (best_err is None or err < best_err):
            best_combo, best_err = dict(w_map), err
    return best_combo, best_err


def evaluate_period(df, period):
    train_df, val_df, test_df = build_period_splits(df, STAGE, period)
    full_cols = lean_cols_for(train_df)
    medians = train_df[full_cols].median()
    train_imp = impute(train_df, full_cols, medians)
    val_imp = impute(val_df, full_cols, medians)
    test_imp = impute(test_df, full_cols, medians)
    train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]

    cols, mat_fn, extra_kwargs = variant_spec(RF_VARIANT, full_cols)
    rf = RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1, **POST_PARAMS, **extra_kwargs)
    rf.fit(mat_fn(train_rows), train_rows["outcome_finishPosition"].values.astype(float))

    rf_train = rf.predict(mat_fn(train_rows))
    rf_val = rf.predict(mat_fn(val_imp))
    rf_test = rf.predict(mat_fn(test_imp))
    grid_train = train_rows[GRID_COL].values.astype(float)
    grid_val = val_imp[GRID_COL].values.astype(float)
    grid_test = test_imp[GRID_COL].values.astype(float)

    # ---- Fixed ensemble (Phase 14/16 style, single weight) ----
    w_fixed, _ = select_weight(val_imp, grid_val, rf_val, PHASE14_WEIGHTS)
    fixed_test = w_fixed * grid_test + (1 - w_fixed) * rf_test

    # ---- Volatility-conditional ensemble ----
    scalers, cutpoints = fit_volatility_buckets(train_imp)
    bucket_val = bucket_from_score(volatility_score(val_imp, scalers), cutpoints)
    bucket_test = bucket_from_score(volatility_score(test_imp, scalers), cutpoints)
    w_map, _ = select_bucket_weights(val_imp, bucket_val, grid_val, rf_val)
    w_per_test = np.array([w_map[b] for b in bucket_test])
    vol_test = w_per_test * grid_test + (1 - w_per_test) * rf_test

    models_scores = {"grid_only": grid_test, "fixed_ensemble": fixed_test, "volatility_conditional": vol_test}
    model_results, per_race_by_model, scored_by_model = {}, {}, {}
    for name, arr in models_scores.items():
        metrics, scored_df = evaluate_with_score(test_imp, arr)
        model_results[name] = metrics
        per_race_by_model[name] = per_race_metrics(scored_df, "_score", ascending=True)
        scored_by_model[name] = scored_df

    # ---- Per-sample records tagged with volatility bucket, for the by-bucket report ----
    sample_rows = []
    for name, scored_df in scored_by_model.items():
        d = scored_df.copy()
        d["predictedPosition"] = d.groupby(["season", "round"])["_score"].transform(
            lambda s: rank_within_race(s, ascending=True)
        )
        buckets = bucket_from_score(volatility_score(d, scalers), cutpoints)
        for row, bucket in zip(d.to_dict("records"), buckets):
            scorable = row["outcome_classification"] in SCORABLE_STATUSES
            actual = row["outcome_finishPosition"] if scorable else None
            pos_err = abs(row["predictedPosition"] - actual) if (scorable and actual is not None) else None
            sample_rows.append({"model": name, "volatilityBucket": bucket, "positionError": pos_err})

    # ---- train/validation/test gap for the underlying RF component ----
    rf_train_metrics, _ = evaluate_with_score(train_rows, rf_train)
    rf_val_metrics, _ = evaluate_with_score(val_imp, rf_val)
    rf_test_metrics, _ = evaluate_with_score(test_imp, rf_test)

    dnf_auc = shared_dnf_auc(train_imp, test_imp, full_cols, POST_PARAMS)

    return {
        "period": period["label"],
        "trainRaces": int(train_df[["season", "round"]].drop_duplicates().shape[0]),
        "valRaces": int(val_df[["season", "round"]].drop_duplicates().shape[0]),
        "testRaces": int(test_df[["season", "round"]].drop_duplicates().shape[0]),
        "volatilityCutpoints": cutpoints,
        "fixedWeightChosen": w_fixed,
        "bucketWeightsChosen": w_map,
        "models": model_results,
        "rfComponentGap": {
            "trainMeanPositionError": rf_train_metrics.get("meanPositionError"),
            "validationMeanPositionError": rf_val_metrics.get("meanPositionError"),
            "testMeanPositionError": rf_test_metrics.get("meanPositionError"),
            "trainValGap": (rf_train_metrics["meanPositionError"] - rf_val_metrics["meanPositionError"])
                if rf_train_metrics.get("available") and rf_val_metrics.get("available") else None,
            "trainTestGap": (rf_train_metrics["meanPositionError"] - rf_test_metrics["meanPositionError"])
                if rf_train_metrics.get("available") and rf_test_metrics.get("available") else None,
        },
        "dnfAucSharedAcrossModels": dnf_auc,
        "_perRaceByModel": per_race_by_model,
        "_sampleRows": sample_rows,
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
    print("PHASE 18 — VOLATILITY-CONDITIONAL ENSEMBLE")
    print("=" * 78)
    print(f"Volatility components: {list(VOL_COLS.values())}")
    print(f"Weight candidates (coarse): {WEIGHT_CANDIDATES}, buckets: {BUCKET_LABELS}")

    period_results = [evaluate_period(df, p) for p in PERIODS]
    models = ["grid_only", "fixed_ensemble", "volatility_conditional"]

    print("\n--- Per-period results ---")
    for r in period_results:
        print(f"\n  {r['period']} (train={r['trainRaces']}, val={r['valRaces']}, test={r['testRaces']}) "
              f"cutpoints={r['volatilityCutpoints']} fixedW={r['fixedWeightChosen']} bucketW={r['bucketWeightsChosen']}")
        for name in models:
            m = r["models"][name]
            if m.get("available"):
                print(f"    {name:24s} winnerAcc={m['winnerAccuracy']:.3f} podium={m['avgPodiumHitRate']:.3f} "
                      f"top5={m['avgTop5HitRate']:.3f} top10={m['avgTop10HitRate']:.3f} meanPosErr={m['meanPositionError']:.3f}")
        gap = r["rfComponentGap"]
        print(f"    RF component: train={gap['trainMeanPositionError']:.3f} val={gap['validationMeanPositionError']:.3f} "
              f"test={gap['testMeanPositionError']:.3f} trainValGap={gap['trainValGap']:.3f} trainTestGap={gap['trainTestGap']:.3f}")
        print(f"    dnfAuc (shared) = {r['dnfAucSharedAcrossModels']}")

    print("\n--- Aggregate (mean +/- std across periods) ---")
    aggregate = {}
    for name in models:
        aggregate[name] = {
            "winnerAccuracy": mean_std([r["models"][name].get("winnerAccuracy") for r in period_results]),
            "avgPodiumHitRate": mean_std([r["models"][name].get("avgPodiumHitRate") for r in period_results]),
            "avgTop5HitRate": mean_std([r["models"][name].get("avgTop5HitRate") for r in period_results]),
            "avgTop10HitRate": mean_std([r["models"][name].get("avgTop10HitRate") for r in period_results]),
            "meanPositionError": mean_std([r["models"][name].get("meanPositionError") for r in period_results]),
        }
        a = aggregate[name]
        print(f"  {name:24s} meanPosErr={a['meanPositionError']['mean']:.3f} +/- {a['meanPositionError']['std']:.3f}  "
              f"winnerAcc={a['winnerAccuracy']['mean']:.3f} +/- {a['winnerAccuracy']['std']:.3f}")

    print("\n--- Pooled bootstrap vs grid-only (60 races) ---")
    pooled = {name: [race for r in period_results for race in r["_perRaceByModel"][name]] for name in models}
    comparisons_vs_grid = {}
    for name in ["fixed_ensemble", "volatility_conditional"]:
        comp = bootstrap_gap(pooled[name], pooled["grid_only"])
        comparisons_vs_grid[name] = comp
        if comp.get("available"):
            print(f"  {name:24s} meanDiff={comp['meanDiff']:+.3f} 95% CI=[{comp['ci95'][0]:+.3f}, {comp['ci95'][1]:+.3f}] excludesZero={comp['ciExcludesZero']}")

    print("\n--- Pooled bootstrap: volatility_conditional vs fixed_ensemble (60 races) ---")
    comp_vs_fixed = bootstrap_gap(pooled["volatility_conditional"], pooled["fixed_ensemble"])
    if comp_vs_fixed.get("available"):
        print(f"  meanDiff={comp_vs_fixed['meanDiff']:+.3f} 95% CI=[{comp_vs_fixed['ci95'][0]:+.3f}, {comp_vs_fixed['ci95'][1]:+.3f}] excludesZero={comp_vs_fixed['ciExcludesZero']}")

    print("\n--- Performance by volatility bucket (pooled sample-level) ---")
    all_sample_rows = [row for r in period_results for row in r["_sampleRows"]]
    import pandas as pd
    sample_df = pd.DataFrame(all_sample_rows).dropna(subset=["positionError"])
    by_bucket = {}
    for name in models:
        g = sample_df[sample_df["model"] == name]
        agg = g.groupby("volatilityBucket")["positionError"].agg(["count", "mean"]).to_dict("index")
        by_bucket[name] = {b: {"n": agg[b]["count"], "mean": agg[b]["mean"]} for b in agg}
        print(f"  {name:24s} {by_bucket[name]}")

    bucket_deltas = {}
    for name in ["fixed_ensemble", "volatility_conditional"]:
        bucket_deltas[name] = {
            b: by_bucket[name][b]["mean"] - by_bucket["grid_only"][b]["mean"]
            for b in BUCKET_LABELS if b in by_bucket[name] and b in by_bucket["grid_only"]
        }
    print(f"\n  Model-minus-grid delta by bucket (negative = model better):")
    for name, deltas in bucket_deltas.items():
        print(f"    {name:24s} {deltas}")

    for r in period_results:
        del r["_perRaceByModel"]
        del r["_sampleRows"]

    report = {
        "stage": STAGE,
        "rfVariant": RF_VARIANT,
        "volatilityComponents": VOL_COLS,
        "weightCandidates": WEIGHT_CANDIDATES,
        "periods": period_results,
        "aggregate": aggregate,
        "vsGridOnlyPooledBootstrap": comparisons_vs_grid,
        "volatilityConditionalVsFixedEnsemble": comp_vs_fixed,
        "performanceByVolatilityBucket": by_bucket,
        "bucketDeltaVsGrid": bucket_deltas,
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\nFull results written to {RESULTS_PATH}")


if __name__ == "__main__":
    main()
