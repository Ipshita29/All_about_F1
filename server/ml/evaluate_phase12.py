#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
PHASE 12 — RANDOM FOREST REGULARIZATION (CAPACITY CONTROL)
═══════════════════════════════════════════════════════════════════

Phase 11 found Gradient Boosting's overfitting gap shrank when redundant
features were removed, but Random Forest's barely moved — RF could still
carve the lean (23/28-feature) set into deep enough trees to nearly
memorize the 879-row training set. Phase 11's own grid only varied
n_estimators/max_depth loosely (and only two max_depth values); this
phase runs a focused, single-purpose sweep over the two hyperparameters
that actually cap a tree's capacity to memorize: max_depth and
min_samples_leaf — holding everything else (features, n_estimators,
target, data) fixed.

Reuses, never re-implements: the lean feature definition (REMOVED_FEATURES,
imported from evaluate_phase11.py), the metric functions (evaluate.py),
the per-race/bootstrap noise-analysis helpers (diagnose_phase10.py).

GRID (5 x 4 = 20 points, n_estimators fixed at 300 — the same default
Phase 4/5/10 have used throughout, so only max_depth/min_samples_leaf
vary, isolating their effect):
  max_depth:        4, 6, 8, 10, None
  min_samples_leaf: 1, 2, 4, 8

Selection is via VALIDATION (2025) only — meanPositionError for the
finishPosition regressor, ROC-AUC for the DNF classifier — exactly
Phase 9/11's own selection rule. 2026 is scored exactly once, after
the grid search is complete, never used to pick a configuration.

Run: python3 ml/evaluate_phase12.py
"""

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.metrics import roc_auc_score

from evaluate import FEATURE_PREFIX, STAGES, SCORABLE_STATUSES, RANDOM_STATE, feature_columns_for, impute, evaluate_scored_split
from evaluate_phase5 import flatten_samples, did_finish
from evaluate_phase11 import REMOVED_FEATURES
from diagnose_phase10 import per_race_metrics, bootstrap_gap

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
DATASET_PATH = ARTIFACT_DIR / "dataset_phase5.json"  # NOT phase8 — no OpenF1
RESULTS_PHASE5_PATH = ARTIFACT_DIR / "results_phase5.json"
RESULTS_PATH = ARTIFACT_DIR / "results_phase12.json"

N_ESTIMATORS = 300  # fixed throughout — only max_depth/min_samples_leaf vary
MAX_DEPTH_GRID = [4, 6, 8, 10, None]
MIN_SAMPLES_LEAF_GRID = [1, 2, 4, 8]


def load_dataset():
    with open(DATASET_PATH) as f:
        return json.load(f)


def lean_cols_for(train_df):
    full_cols = feature_columns_for(train_df)
    return [c for c in full_cols if c[len(FEATURE_PREFIX):] not in REMOVED_FEATURES]
