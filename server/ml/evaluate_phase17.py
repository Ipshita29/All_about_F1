#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 17 — PREDICTION ERROR ANALYSIS (diagnosis only, no new model)
═══════════════════════════════════════════════════════════════════

Phases 13-16 established that, post-qualifying, nothing beats grid-only
with statistical confidence — core_subset and the Phase 14 ensemble are
the best (non-significant) candidates. This phase does not try another
model. It takes the SAME three reference scorers (grid-only, Phase 14
full-lean ensemble, core_subset ensemble) over the SAME rolling 2024/
2025/2026 test periods, and asks WHERE their errors concentrate — by
circuit, grid-position range, driver/team tier (championship-standing
tertile, since there's no "tier" field — this is the same feature
already used everywhere else, not a new one), DNF/classified status,
race volatility (large position swings), weather, season, and predicted-
vs-actual position.

Two granularities, both built from the SAME per-sample scores already
used by every prior phase — no re-fitting beyond the three reference
models themselves, no tuning on test data:

  sample_df — one row per driver per race per model: positionError,
              gridPosition, predictedPosition, actualPosition,
              classification, actualGridDelta, championship tertile,
              weather. Used for driver-level cuts.
  race_df   — one row per race per model, reusing diagnose_phase10's
              per_race_metrics (not re-implemented) for winnerCorrect /
              podiumHitRate / meanPositionError, with circuitId, season,
              and a race-level wet/dry flag merged in. Used for cuts
              where "winner accuracy" is meaningful.

circuitId/constructorId aren't carried by evaluate_phase5.flatten_samples
(built for modeling, not diagnosis), so this phase has its own minimal
flatten_with_meta() that adds them — read-only metadata, not a new
feature, not used by any model's feature matrix.

Does NOT touch the model, features, targets, or production code. Does
NOT tune anything on test data — the three scorers are exactly the fixed
models Phases 14/16 already validated via train/validation only.

Reuses, never re-implements: PERIODS / build_period_splits / lean_cols_for
/ RF_PARAMS_BY_STAGE / N_ESTIMATORS / load_dataset (evaluate_phase13.py),
PHASE14_WEIGHTS / select_weight / GRID_COL (evaluate_phase15.py),
variant_spec / CORE_SUBSET_COLS (evaluate_phase16.py), rank_within_race /
SCORABLE_STATUSES / FEATURE_PREFIX / impute (evaluate.py), per_race_metrics
(diagnose_phase10.py), did_finish (evaluate_phase5.py).

Run: python3 ml/evaluate_phase17.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from evaluate import FEATURE_PREFIX, SCORABLE_STATUSES, RANDOM_STATE, impute, rank_within_race
from evaluate_phase5 import did_finish
from evaluate_phase13 import (
    PERIODS, build_period_splits, lean_cols_for, RF_PARAMS_BY_STAGE, N_ESTIMATORS, load_dataset,
)
from evaluate_phase15 import PHASE14_WEIGHTS, select_weight, GRID_COL
from evaluate_phase16 import variant_spec
from diagnose_phase10 import per_race_metrics

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
RESULTS_PATH = ARTIFACT_DIR / "results_phase17.json"

STAGE = "post_qualifying"
POST_PARAMS = RF_PARAMS_BY_STAGE[STAGE]
MODELS = ["grid_only", "phase14_full_lean", "core_subset"]


def flatten_with_meta(samples):
    rows = []
    for s in samples:
        row = {
            "season": s["season"], "round": int(s["round"]), "race": s["race"],
            "circuitId": s["circuitId"], "driverId": s["driverId"],
            "constructorId": s["constructorId"], "constructorName": s.get("constructorName"),
            "stage": s["stage"], "split": s["split"],
            "outcome_finishPosition": s["outcome"]["finishPosition"],
            "outcome_gridPosition": s["outcome"]["gridPosition"],
            "outcome_classification": s["outcome"]["classification"],
            "outcome_status": s["outcome"]["status"],
        }
        for k, v in s["mlFeatures"].items():
            row[f"{FEATURE_PREFIX}{k}"] = v
        rows.append(row)
    return pd.DataFrame(rows)


def bucket_position(pos):
    if pos is None or (isinstance(pos, float) and np.isnan(pos)):
        return None
    if pos <= 3:
        return "P1-3"
    if pos <= 8:
        return "P4-8"
    if pos <= 14:
        return "P9-14"
    return "P15+"


def bucket_delta(delta):
    if delta is None or (isinstance(delta, float) and np.isnan(delta)):
        return None
    if delta <= -5:
        return "big_gainer (-5 or more)"
    if delta <= -1:
        return "moderate_gainer (-1 to -4)"
    if delta == 0:
        return "stable (0)"
    if delta <= 4:
        return "moderate_loser (+1 to +4)"
    return "big_loser (+5 or more)"


def bucket_dnf_count(n):
    if n == 0:
        return "0_dnfs"
    if n <= 2:
        return "1-2_dnfs"
    return "3+_dnfs"


def attach_predicted_position(test_imp, score_col):
    d = test_imp.copy()
    d["predictedPosition"] = d.groupby(["season", "round"])[score_col].transform(
        lambda s: rank_within_race(s, ascending=True)
    )
    return d


def to_sample_records(d, model_name, period_label):
    records = []
    for r in d.to_dict("records"):
        scorable = r["outcome_classification"] in SCORABLE_STATUSES
        actual = r["outcome_finishPosition"] if scorable else None
        pos_err = abs(r["predictedPosition"] - actual) if (scorable and actual is not None) else None
        grid = r.get(GRID_COL)
        records.append({
            "model": model_name, "period": period_label,
            "season": r["season"], "round": r["round"],
            "circuitId": r.get("circuitId"), "constructorId": r.get("constructorId"),
            "driverId": r["driverId"],
            "gridPosition": grid,
            "predictedPosition": r["predictedPosition"],
            "actualPosition": actual,
            "classification": r["outcome_classification"],
            "didFinish": did_finish(r["outcome_status"]),
            "positionError": pos_err,
            "actualGridDelta": (actual - grid) if (actual is not None and grid is not None) else None,
            "championshipScore": r.get(f"{FEATURE_PREFIX}championshipStandingScore"),
            "weatherPrecip": r.get(f"{FEATURE_PREFIX}weatherPrecipitationAmount"),
        })
    return records


def fit_scorers(df, period):
    train_df, val_df, test_df = build_period_splits(df, STAGE, period)
    full_cols = lean_cols_for(train_df)
    medians = train_df[full_cols].median()
    train_imp = impute(train_df, full_cols, medians)
    val_imp = impute(val_df, full_cols, medians)
    test_imp = impute(test_df, full_cols, medians)
    train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES)]

    grid_val = val_imp[GRID_COL].values.astype(float)
    grid_test = test_imp[GRID_COL].values.astype(float)

    test_scores = {"grid_only": grid_test}
    for name in ["phase14_full_lean", "core_subset"]:
        cols, mat_fn, extra_kwargs = variant_spec(name, full_cols)
        rf = RandomForestRegressor(n_estimators=N_ESTIMATORS, random_state=RANDOM_STATE, n_jobs=-1, **POST_PARAMS, **extra_kwargs)
        rf.fit(mat_fn(train_rows), train_rows["outcome_finishPosition"].values.astype(float))
        rf_val = rf.predict(mat_fn(val_imp))
        w, _ = select_weight(val_imp, grid_val, rf_val, PHASE14_WEIGHTS)
        rf_test = rf.predict(mat_fn(test_imp))
        test_scores[name] = w * grid_test + (1 - w) * rf_test

    return test_imp, test_scores


def build_pooled_frames(df):
    sample_rows, race_rows = [], []
    for period in PERIODS:
        test_imp, test_scores = fit_scorers(df, period)
        for model_name, score_arr in test_scores.items():
            d = test_imp.copy()
            d["_score"] = score_arr
            d = attach_predicted_position(d, "_score")
            sample_rows.extend(to_sample_records(d, model_name, period["label"]))

            for race in per_race_metrics(test_imp.assign(_score=score_arr), "_score", ascending=True):
                race_rows.append({"model": model_name, "period": period["label"], **race})

    sample_df = pd.DataFrame(sample_rows)
    race_df = pd.DataFrame(race_rows)

    # Merge circuitId and wet/dry flag (race-level, constant across drivers in a race) into race_df.
    race_meta = (
        sample_df[sample_df["model"] == "grid_only"]
        .groupby(["season", "round"])
        .agg(circuitId=("circuitId", "first"), wetRace=("weatherPrecip", lambda s: bool((s.fillna(0) > 0.1).any())))
        .reset_index()
    )
    race_df = race_df.merge(race_meta, on=["season", "round"], how="left")

    dnf_count = (
        sample_df[sample_df["model"] == "grid_only"]
        .groupby(["season", "round"])["didFinish"]
        .apply(lambda s: int((s == 0).sum()))
        .reset_index(name="dnfCount")
    )
    race_df = race_df.merge(dnf_count, on=["season", "round"], how="left")

    return sample_df, race_df


def summarize(df, group_col, value_col="positionError"):
    out = {}
    for model in MODELS:
        g = df[df["model"] == model].dropna(subset=[group_col])
        agg = g.groupby(group_col)[value_col].agg(["count", "mean", "median"]).to_dict("index")
        out[model] = {str(k): {"n": v["count"], "mean": v["mean"], "median": v["median"]} for k, v in agg.items()}
    return out


def summarize_race_level(race_df, group_col):
    out = {}
    for model in MODELS:
        g = race_df[race_df["model"] == model].dropna(subset=[group_col])
        agg = g.groupby(group_col).agg(
            races=("round", "count"),
            meanPositionError=("meanPositionError", "mean"),
            winnerAccuracy=("winnerCorrect", "mean"),
            avgPodiumHitRate=("podiumHitRate", "mean"),
        ).to_dict("index")
        out[model] = {str(k): v for k, v in agg.items()}
    return out


def diff_vs_grid(summary_dict, metric="mean"):
    diffs = {}
    grid = summary_dict.get("grid_only", {})
    for model in ["phase14_full_lean", "core_subset"]:
        diffs[model] = {}
        for key, grid_stats in grid.items():
            model_stats = summary_dict.get(model, {}).get(key)
            if model_stats and grid_stats.get(metric) is not None and model_stats.get(metric) is not None:
                diffs[model][key] = model_stats[metric] - grid_stats[metric]
    return diffs


def main():
    data = load_dataset()
    df = flatten_with_meta(data["samples"])

    print("=" * 78)
    print("PHASE 17 — PREDICTION ERROR ANALYSIS")
    print("=" * 78)

    sample_df, race_df = build_pooled_frames(df)

    # Tertiles of championship standing, computed on the pooled TEST set itself (descriptive only).
    champ_vals = sample_df[sample_df["model"] == "grid_only"]["championshipScore"].dropna()
    q1, q2 = champ_vals.quantile([1 / 3, 2 / 3])
    sample_df["tier"] = pd.cut(
        sample_df["championshipScore"], bins=[-np.inf, q1, q2, np.inf],
        labels=["backmarker", "midfield", "top_tier"]
    )

    sample_df["gridBucket"] = sample_df["gridPosition"].apply(bucket_position)
    sample_df["predictedBucket"] = sample_df["predictedPosition"].apply(bucket_position)
    sample_df["deltaBucket"] = sample_df["actualGridDelta"].apply(bucket_delta)
    race_df["dnfBucket"] = race_df["dnfCount"].apply(bucket_dnf_count)
    race_df["wetDry"] = race_df["wetRace"].map({True: "wet", False: "dry"})

    report = {}

    print("\n--- 1. By circuit (race-level) ---")
    by_circuit = summarize_race_level(race_df, "circuitId")
    report["byCircuit"] = {"summary": by_circuit, "vsGridOnly": diff_vs_grid(by_circuit, "meanPositionError")}
    for model in MODELS:
        top = sorted(by_circuit[model].items(), key=lambda kv: -kv[1]["meanPositionError"])[:5]
        print(f"  {model}: worst circuits by meanPositionError: {[(k, round(v['meanPositionError'],3), v['races']) for k,v in top]}")

    print("\n--- 2. By grid-position range (sample-level) ---")
    by_grid = summarize(sample_df, "gridBucket")
    report["byGridRange"] = {"summary": by_grid, "vsGridOnly": diff_vs_grid(by_grid)}
    for model in MODELS:
        print(f"  {model}: {by_grid[model]}")

    print("\n--- 3. By driver/team tier (championship tertile, sample-level) ---")
    by_tier = summarize(sample_df, "tier")
    report["byTier"] = {"summary": by_tier, "vsGridOnly": diff_vs_grid(by_tier)}
    for model in MODELS:
        print(f"  {model}: {by_tier[model]}")

    print("\n--- 4. By DNF count in race (race-level) ---")
    by_dnf = summarize_race_level(race_df, "dnfBucket")
    report["byDnfCount"] = {"summary": by_dnf, "vsGridOnly": diff_vs_grid(by_dnf, "meanPositionError")}
    for model in MODELS:
        print(f"  {model}: {by_dnf[model]}")

    print("\n--- 5. By position gain/loss magnitude (sample-level) ---")
    by_delta = summarize(sample_df, "deltaBucket")
    report["byPositionSwing"] = {"summary": by_delta, "vsGridOnly": diff_vs_grid(by_delta)}
    for model in MODELS:
        print(f"  {model}: {by_delta[model]}")

    print("\n--- 6. By race conditions: wet vs dry (race-level) ---")
    by_wet = summarize_race_level(race_df, "wetDry")
    report["byWeather"] = {"summary": by_wet, "vsGridOnly": diff_vs_grid(by_wet, "meanPositionError")}
    for model in MODELS:
        print(f"  {model}: {by_wet[model]}")

    print("\n--- 7. By season (race-level) ---")
    by_season = summarize_race_level(race_df, "period")
    report["bySeason"] = {"summary": by_season, "vsGridOnly": diff_vs_grid(by_season, "meanPositionError")}
    for model in MODELS:
        print(f"  {model}: {by_season[model]}")

    print("\n--- 8. By predicted-position bucket (sample-level: predicted vs actual) ---")
    by_pred = {}
    for model in MODELS:
        g = sample_df[(sample_df["model"] == model) & sample_df["predictedBucket"].notna()]
        agg = g.groupby("predictedBucket").agg(
            n=("positionError", "count"),
            meanError=("positionError", "mean"),
            meanActualPosition=("actualPosition", "mean"),
        ).to_dict("index")
        by_pred[model] = {str(k): v for k, v in agg.items()}
        print(f"  {model}: {by_pred[model]}")
    report["byPredictedBucket"] = by_pred

    # ---- Concentration: do a small subset of circuits/races account for a disproportionate share of error? ----
    print("\n--- Error concentration (grid_only, as the common reference) ---")
    grid_races = race_df[race_df["model"] == "grid_only"].dropna(subset=["meanPositionError"]).copy()
    grid_races = grid_races.sort_values("meanPositionError", ascending=False)
    total_error = grid_races["meanPositionError"].sum()
    top5_share = grid_races.head(5)["meanPositionError"].sum() / total_error if total_error else None
    print(f"  top-5 worst races account for {top5_share:.1%} of total summed race-level meanPositionError "
          f"(out of {len(grid_races)} races)")
    report["errorConcentration"] = {
        "totalRaces": int(len(grid_races)),
        "top5WorstRacesShareOfTotalError": float(top5_share) if top5_share is not None else None,
        "top5WorstRaces": grid_races.head(5)[["season", "round", "circuitId", "meanPositionError"]].to_dict("records"),
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\nFull results written to {RESULTS_PATH}")


if __name__ == "__main__":
    main()
