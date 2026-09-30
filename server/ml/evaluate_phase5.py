#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 5 — RACE-PACE FEATURE EVALUATION
═══════════════════════════════════════════════════════════════════

Phase 4's finding: championshipStandingScore and gridPosition dominate
feature importance; everything else contributes little. This script:

  1. Compares the ORIGINAL Phase 4 feature set against Phase 4 + the 5
     new Phase 5 race-pace features (see compute_race_pace_features.js)
     on the SAME finishing-position task Phase 4 evaluated, using the
     exact same rank-based race metrics (imported from evaluate.py,
     never re-implemented) — a direct, apples-to-apples "did this help"
     comparison against the Phase 4 baseline numbers already reported.

  2. Evaluates a NEW target, positionChange = finishPosition - gridPosition
     (POST_QUALIFYING only — gridPosition doesn't exist pre-qualifying),
     old vs new feature set, via mean absolute error.

  3. Evaluates a NEW target, didFinish (1 = classified running at the end,
     0 = DNF — same status-text rule Phase 2's own reliability features
     already use), old vs new feature set, via accuracy + ROC-AUC.

Same chronological splits as Phase 4 (train=2023-24, validation=2025,
test=2026), same leakage discipline, same "don't tune for winner
accuracy" instruction — reasonable default hyperparameters, every
metric reported, no cherry-picking.

Run: python3 ml/evaluate_phase5.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, accuracy_score, roc_auc_score

from evaluate import (
    FEATURE_PREFIX, STAGES, SCORABLE_STATUSES, RANDOM_STATE,
    feature_columns_for, impute, evaluate_scored_split,
)

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
DATASET_PATH = ARTIFACT_DIR / "dataset_phase5.json"
RESULTS_PATH = ARTIFACT_DIR / "results_phase5.json"


def load_dataset():
    with open(DATASET_PATH) as f:
        return json.load(f)


def flatten_samples(samples):
    """Like evaluate.py's flatten_samples, but also carries outcome_status
    and outcome_gridPosition — needed for the two new Phase 5 targets,
    which evaluate.py's own flattening (built for Phase 4's finishPosition
    task only) doesn't retain."""
    rows = []
    for s in samples:
        row = {
            "season": s["season"], "round": int(s["round"]), "race": s["race"],
            "driverId": s["driverId"], "stage": s["stage"], "split": s["split"],
            "outcome_finishPosition": s["outcome"]["finishPosition"],
            "outcome_gridPosition": s["outcome"]["gridPosition"],
            "outcome_classification": s["outcome"]["classification"],
            "outcome_status": s["outcome"]["status"],
        }
        for k, v in s["mlFeatures"].items():
            row[f"{FEATURE_PREFIX}{k}"] = v
        rows.append(row)
    return pd.DataFrame(rows)


def did_finish(status):
    # Same rule as backtestDatasetService.computeReliabilityFeature /
    # featureEngineeringService's driverDnfRate — reused for the label,
    # not re-derived with different logic.
    if status is None:
        return None
    return 1 if (status == "Finished" or str(status).startswith("+")) else 0


# ---------------------------------------------------------------------------
# Task 1: finishing position — SAME task/metrics as Phase 4, old vs new features
# ---------------------------------------------------------------------------

def train_rf_regressor(train_df, eval_df, feature_cols, target_col):
    train_rows = train_df[train_df["outcome_classification"].isin(SCORABLE_STATUSES)]
    X_train = train_rows[feature_cols].values
    y_train = train_rows[target_col].values.astype(float)
    rf = RandomForestRegressor(n_estimators=300, random_state=RANDOM_STATE, n_jobs=-1)
    rf.fit(X_train, y_train)
    return rf, rf.predict(eval_df[feature_cols].values), len(train_rows)


def compare_finish_position(train_imp, val_imp, test_imp, old_cols, new_cols, stage_report):
    for label, cols in [("phase4_features_only", old_cols), ("phase4_plus_phase5_features", new_cols)]:
        rf, val_scores, n_train = train_rf_regressor(train_imp, val_imp, cols, "outcome_finishPosition")
        _, test_scores, _ = train_rf_regressor(train_imp, test_imp, cols, "outcome_finishPosition")

        v = val_imp.copy()
        t = test_imp.copy()
        v["_score"] = val_scores
        t["_score"] = test_scores

        result = {
            "trainRows": n_train,
            "featureCount": len(cols),
            "validation": evaluate_scored_split(v, "_score", ascending=True),
            "test": evaluate_scored_split(t, "_score", ascending=True),
        }
        if label == "phase4_plus_phase5_features":
            names = [c[len(FEATURE_PREFIX):] for c in cols]
            result["featureImportance"] = sorted(zip(names, rf.feature_importances_.tolist()), key=lambda x: -x[1])[:15]
        stage_report[f"finishPosition_{label}"] = result


# ---------------------------------------------------------------------------
# Task 2: positionChange = finish - grid (POST_QUALIFYING only)
# ---------------------------------------------------------------------------

def compare_position_change(train_imp, val_imp, test_imp, old_cols, new_cols, stage_report):
    for df in (train_imp, val_imp, test_imp):
        df["target_positionChange"] = df["outcome_finishPosition"] - df["outcome_gridPosition"]

    train_rows = train_imp[train_imp["outcome_classification"].isin(SCORABLE_STATUSES) & train_imp["target_positionChange"].notna()]

    for label, cols in [("phase4_features_only", old_cols), ("phase4_plus_phase5_features", new_cols)]:
        X_train = train_rows[cols].values
        y_train = train_rows["target_positionChange"].values.astype(float)
        rf = RandomForestRegressor(n_estimators=300, random_state=RANDOM_STATE, n_jobs=-1)
        rf.fit(X_train, y_train)

        result = {"trainRows": len(train_rows), "featureCount": len(cols)}
        for split_name, df in [("validation", val_imp), ("test", test_imp)]:
            eval_rows = df[df["outcome_classification"].isin(SCORABLE_STATUSES) & df["target_positionChange"].notna()]
            if len(eval_rows) == 0:
                result[split_name] = {"available": False}
                continue
            preds = rf.predict(eval_rows[cols].values)
            actual = eval_rows["target_positionChange"].values.astype(float)
            result[split_name] = {
                "available": True,
                "n": len(eval_rows),
                "mae": float(mean_absolute_error(actual, preds)),
                "meanAbsActualChange": float(np.mean(np.abs(actual))),  # naive "predict 0 change" baseline MAE
            }
        if label == "phase4_plus_phase5_features":
            names = [c[len(FEATURE_PREFIX):] for c in cols]
            result["featureImportance"] = sorted(zip(names, rf.feature_importances_.tolist()), key=lambda x: -x[1])[:15]
        stage_report[f"positionChange_{label}"] = result


# ---------------------------------------------------------------------------
# Task 3: didFinish (DNF classification), both stages
# ---------------------------------------------------------------------------

def compare_did_finish(train_imp, val_imp, test_imp, old_cols, new_cols, stage_report):
    for df in (train_imp, val_imp, test_imp):
        df["target_didFinish"] = df["outcome_status"].apply(did_finish)

    train_rows = train_imp[train_imp["target_didFinish"].notna()]
    base_rate = float(train_rows["target_didFinish"].mean())

    for label, cols in [("phase4_features_only", old_cols), ("phase4_plus_phase5_features", new_cols)]:
        X_train = train_rows[cols].values
        y_train = train_rows["target_didFinish"].values.astype(int)

        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)

        lr = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=RANDOM_STATE)
        lr.fit(X_train_scaled, y_train)

        rf = RandomForestClassifier(n_estimators=300, random_state=RANDOM_STATE, n_jobs=-1, class_weight="balanced")
        rf.fit(X_train, y_train)

        result = {"trainRows": len(train_rows), "featureCount": len(cols), "dnfBaseRateInTrain": round(1 - base_rate, 3)}
        for split_name, df in [("validation", val_imp), ("test", test_imp)]:
            eval_rows = df[df["target_didFinish"].notna()]
            if len(eval_rows) == 0 or eval_rows["target_didFinish"].nunique() < 2:
                result[split_name] = {"available": False, "reason": "insufficient class variety in this split"}
                continue
            y_true = eval_rows["target_didFinish"].values.astype(int)
            X_eval = eval_rows[cols].values
            X_eval_scaled = scaler.transform(X_eval)

            lr_proba = lr.predict_proba(X_eval_scaled)[:, 1]
            rf_proba = rf.predict_proba(X_eval)[:, 1]
            result[split_name] = {
                "available": True,
                "n": len(eval_rows),
                "logistic_regression": {
                    "accuracy": float(accuracy_score(y_true, (lr_proba >= 0.5).astype(int))),
                    "rocAuc": float(roc_auc_score(y_true, lr_proba)),
                },
                "random_forest": {
                    "accuracy": float(accuracy_score(y_true, (rf_proba >= 0.5).astype(int))),
                    "rocAuc": float(roc_auc_score(y_true, rf_proba)),
                },
            }
        if label == "phase4_plus_phase5_features":
            names = [c[len(FEATURE_PREFIX):] for c in cols]
            result["featureImportance"] = sorted(zip(names, rf.feature_importances_.tolist()), key=lambda x: -x[1])[:15]
        stage_report[f"didFinish_{label}"] = result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    data = load_dataset()
    df = flatten_samples(data["samples"])
    phase5_cols = [f"{FEATURE_PREFIX}{k}" for k in data["phase5FeaturesAdded"]]

    report = {"generatedAt": data["generatedAt"], "phase5FeaturesAdded": data["phase5FeaturesAdded"], "stages": {}}

    print("=" * 78)
    print("PHASE 5 — RACE-PACE FEATURE EVALUATION")
    print("=" * 78)
    print(f"New Phase 5 features: {data['phase5FeaturesAdded']}")

    for stage in STAGES:
        print("\n" + "=" * 78)
        print(f"STAGE: {stage}")
        print("=" * 78)

        df_stage = df[df["stage"] == stage].copy()
        train_df = df_stage[df_stage["split"] == "train"]
        val_df = df_stage[df_stage["split"] == "validation"]
        test_df = df_stage[df_stage["split"] == "test"]

        old_cols_all = [c for c in feature_columns_for(train_df) if c not in phase5_cols]
        new_cols_usable = [c for c in phase5_cols if train_df[c].notna().any()]
        all_cols = old_cols_all + new_cols_usable

        print(f"Phase 4 feature count: {len(old_cols_all)} | + Phase 5 usable new features: {len(new_cols_usable)} -> {len(all_cols)} total")
        if len(new_cols_usable) < len(phase5_cols):
            missing = set(phase5_cols) - set(new_cols_usable)
            print(f"  (note: {[c[len(FEATURE_PREFIX):] for c in missing]} entirely null in this stage's train split)")

        medians = train_df[all_cols].median()
        train_imp = impute(train_df, all_cols, medians)
        val_imp = impute(val_df, all_cols, medians)
        test_imp = impute(test_df, all_cols, medians)

        stage_report = {
            "sampleCounts": {"train": len(train_df), "validation": len(val_df), "test": len(test_df)},
            "oldFeatureCount": len(old_cols_all),
            "newFeatureCount": len(new_cols_usable),
        }

        # Task 1: finishing position (same task as Phase 4)
        compare_finish_position(train_imp, val_imp, test_imp, old_cols_all, all_cols, stage_report)

        # Task 2: positionChange — post-qualifying only (needs real grid position)
        if stage == "post_qualifying":
            compare_position_change(train_imp, val_imp, test_imp, old_cols_all, all_cols, stage_report)

        # Task 3: didFinish — both stages
        compare_did_finish(train_imp, val_imp, test_imp, old_cols_all, all_cols, stage_report)

        report["stages"][stage] = stage_report

        # ---- print ----
        for task_label in ["finishPosition", "positionChange", "didFinish"]:
            for variant in ["phase4_features_only", "phase4_plus_phase5_features"]:
                key = f"{task_label}_{variant}"
                if key not in stage_report:
                    continue
                r = stage_report[key]
                print(f"\n--- {key} ---")
                for split_name in ["validation", "test"]:
                    if split_name not in r:
                        continue
                    m = r[split_name]
                    if not m.get("available"):
                        print(f"  {split_name}: not available")
                        continue
                    if task_label == "finishPosition":
                        print(f"  {split_name}: races={m['racesEvaluated']} winnerAcc={m['winnerAccuracy']:.3f} podium={m['avgPodiumHitRate']:.3f} top5={m['avgTop5HitRate']:.3f} top10={m['avgTop10HitRate']:.3f} meanPosErr={m['meanPositionError']:.3f}")
                    elif task_label == "positionChange":
                        print(f"  {split_name}: n={m['n']} MAE={m['mae']:.3f} (naive-zero-change MAE={m['meanAbsActualChange']:.3f})")
                    elif task_label == "didFinish":
                        print(f"  {split_name}: n={m['n']} LR(acc={m['logistic_regression']['accuracy']:.3f}, auc={m['logistic_regression']['rocAuc']:.3f}) RF(acc={m['random_forest']['accuracy']:.3f}, auc={m['random_forest']['rocAuc']:.3f})")
                if "featureImportance" in r:
                    print(f"  top features: {r['featureImportance'][:6]}")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\nFull results written to {RESULTS_PATH}")


if __name__ == "__main__":
    main()
