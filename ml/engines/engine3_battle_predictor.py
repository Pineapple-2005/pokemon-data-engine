"""
Engine 3 — Battle Predictor
=============================
Predicts the winner between two Pokémon teams using a 5-model ensemble.

Models:
  • DecisionTreeClassifier  (max_depth=6)
  • RandomForestClassifier  (n_estimators=100)
  • LogisticRegression      (max_iter=1000)
  • GaussianNB
  • KNeighborsClassifier    (n_neighbors=5)
  • Ensemble: majority vote + weighted confidence average

Features: 13 differential stats between Team A and Team B.

Trained models are persisted to ml/models/ via joblib.
Auto-trains from synthetic_battles.csv on first use if models are missing.
"""

from __future__ import annotations

import csv
import logging
import os
from pathlib import Path
from typing import Any, Optional

# joblib is used exclusively to load models that THIS service trained and wrote.
# The load path is resolved from a hard-coded directory (ml/models/) and is never
# derived from user input, so pickle deserialization is safe here.
import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    brier_score_loss,
    log_loss,
    confusion_matrix,
)

from ml.constants import TYPE_CHART, TYPES, ROLES
from ml.utils.feature_builder import build_team_features as _build_team_features_util

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths — resolved relative to this file so they work regardless of cwd
# ---------------------------------------------------------------------------
_ML_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = _ML_ROOT / "models"
DEFAULT_BATTLES_CSV = _ML_ROOT / "data" / "processed" / "synthetic_battles.csv"

MODEL_KEYS = ["dt", "rf", "lr", "nb", "knn"]
MODEL_FILE_MAP = {
    "dt": MODELS_DIR / "engine3_dt.pkl",
    "rf": MODELS_DIR / "engine3_rf.pkl",
    "lr": MODELS_DIR / "engine3_lr.pkl",
    "nb": MODELS_DIR / "engine3_nb.pkl",
    "knn": MODELS_DIR / "engine3_knn.pkl",
}
# Weights for ensemble confidence averaging (order matches MODEL_KEYS)
MODEL_WEIGHTS = {"dt": 0.15, "rf": 0.35, "lr": 0.20, "nb": 0.10, "knn": 0.20}

# ---------------------------------------------------------------------------
# In-process model cache so FastAPI doesn't reload on every request
# ---------------------------------------------------------------------------
_model_cache: dict[str, Any] = {}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(val: Any, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _mean_stat(team: list[dict], key: str) -> float:
    vals = [_safe_float(p.get(key, 0)) for p in team]
    return float(np.mean(vals)) if vals else 0.0


def _sum_stat(team: list[dict], key: str) -> float:
    return sum(_safe_float(p.get(key, 0)) for p in team)


def _type_coverage(team: list[dict]) -> float:
    """Fraction of 18 types hit for >= 2x by at least one member."""
    covered: set[str] = set()
    for p in team:
        for t in [p.get("type_1"), p.get("type_2")]:
            if not t:
                continue
            t = t.lower()
            if t in TYPE_CHART:
                for def_type, mult in TYPE_CHART[t].items():
                    if mult >= 2.0:
                        covered.add(def_type)
    return len(covered) / len(TYPES)


def _weakness_count(team: list[dict]) -> int:
    total = 0
    for p in team:
        t1 = (p.get("type_1") or "").lower()
        t2 = (p.get("type_2") or "").lower() or None
        for atk in TYPES:
            mult1 = TYPE_CHART.get(atk, {}).get(t1, 1.0)
            mult2 = TYPE_CHART.get(atk, {}).get(t2, 1.0) if t2 else 1.0
            if mult1 * mult2 > 1.0:
                total += 1
    return total


def _has_all_roles(team: list[dict]) -> int:
    """Return 1 if the team covers all 5 ROLES, else 0."""
    team_roles = {(p.get("role_label") or "").lower() for p in team}
    return 1 if all(r in team_roles for r in ROLES) else 0


def _unique_types(team: list[dict]) -> int:
    types: set[str] = set()
    for p in team:
        for t in [p.get("type_1"), p.get("type_2")]:
            if t:
                types.add(t.lower())
    return len(types)


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------

def build_features(team_a: list[dict], team_b: list[dict]) -> dict:
    """Return the 10 differential feature dict for (A, B).

    Delegates to utils.feature_builder.build_team_features so that Engine 3
    and the pipeline use the exact same feature definitions.  The local
    helper functions (_mean_stat, _weakness_count, etc.) are kept below as
    fallback utilities only.
    """
    return _build_team_features_util(team_a, team_b)


FEATURE_ORDER = [
    "speed_adv", "stat_adv", "coverage_adv", "weakness_adv",
    "hp_adv", "atk_adv", "sp_atk_adv", "def_adv",
    "type_diversity_adv", "role_balance_a", "matchup_adv",
    "speed_control_adv", "dmg_matchup_adv",
]


def features_to_vector(feat_dict: dict) -> np.ndarray:
    return np.array([feat_dict.get(k, 0.0) for k in FEATURE_ORDER], dtype=float).reshape(1, -1)


# ---------------------------------------------------------------------------
# Model instantiation
# ---------------------------------------------------------------------------

def _build_models() -> dict[str, Any]:
    return {
        "dt":  DecisionTreeClassifier(max_depth=6, random_state=42),
        "rf":  RandomForestClassifier(n_estimators=100, random_state=42),
        "lr":  LogisticRegression(max_iter=1000, random_state=42),
        "nb":  GaussianNB(),
        "knn": KNeighborsClassifier(n_neighbors=5),
    }


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

def _save_models(models: dict[str, Any]) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    for key, model in models.items():
        path = MODEL_FILE_MAP[key]
        joblib.dump(model, path)
        logger.info("Saved model %s to %s", key, path)


def _load_models() -> Optional[dict[str, Any]]:
    """Load all models from disk. Returns None if any are missing."""
    models: dict[str, Any] = {}
    for key, path in MODEL_FILE_MAP.items():
        if not path.exists():
            logger.warning("Model file missing: %s", path)
            return None
        models[key] = joblib.load(path)
        logger.info("Loaded model %s from %s", key, path)
    return models


def get_models() -> dict[str, Any]:
    """Return models from in-process cache or disk. Raises if unavailable."""
    global _model_cache
    if _model_cache:
        return _model_cache
    loaded = _load_models()
    if loaded is None:
        raise RuntimeError("Models not trained. Call train() first.")
    _model_cache = loaded
    return _model_cache


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(battles_csv_path: Optional[str] = None) -> dict:
    """
    Load battle CSV, train all 5 models, save to ml/models/, return metrics.

    CSV columns expected:
        speed_adv, stat_adv, coverage_adv, weakness_adv, hp_adv, atk_adv,
        sp_atk_adv, def_adv, type_diversity_adv, role_balance_a, matchup_adv,
        speed_control_adv, dmg_matchup_adv, winner
    where winner = 'A' or 'B'.
    """
    global _model_cache

    csv_path = Path(battles_csv_path) if battles_csv_path else DEFAULT_BATTLES_CSV

    if not csv_path.exists():
        logger.warning("Battles CSV not found at %s — generating synthetic data", csv_path)
        X, y = _generate_synthetic_data(n_samples=2000)
    else:
        logger.info("Loading battles from %s", csv_path)
        df = pd.read_csv(csv_path)
        # Validate required columns
        required = set(FEATURE_ORDER + ["winner"])
        missing = required - set(df.columns)
        if missing:
            logger.warning("CSV missing columns %s — using synthetic data", missing)
            X, y = _generate_synthetic_data(n_samples=2000)
        else:
            X = df[FEATURE_ORDER].values.astype(float)
            # Support two winner encodings from the pipeline:
            #   generate_synthetic_battles.py writes integer 0 (A wins) / 1 (B wins)
            #   retrain_with_ground_truth() writes string 'A' / 'B'
            # Normalise both to: 1 = A wins, 0 = B wins
            raw_winner = df["winner"]
            if raw_winner.dtype == object or raw_winner.dtype.kind in ("U", "S"):
                # String encoding: 'A' → 1, 'B' → 0
                y = (raw_winner.str.upper() == "A").astype(int).values
            else:
                # Integer encoding: 0 = A wins → invert so 1 = A wins
                y = (raw_winner.astype(int) == 0).astype(int).values

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    models = _build_models()
    for key, model in models.items():
        model.fit(X_train, y_train)
        logger.info("Trained %s", key)

    # Compute metrics on test set
    metrics = _compute_metrics(models, X_test, y_test)

    # Save to disk and warm the in-process cache
    _save_models(models)
    _model_cache = models

    return {
        "status": "trained",
        "train_size": len(X_train),
        "test_size": len(X_test),
        "metrics": metrics,
    }


def retrain_with_ground_truth(new_battle: dict) -> dict:
    """
    Append one real battle result to synthetic data and retrain all models.

    new_battle should contain all FEATURE_ORDER keys + "winner" = 'A' or 'B'.
    """
    DEFAULT_BATTLES_CSV.parent.mkdir(parents=True, exist_ok=True)

    row = {k: new_battle.get(k, 0.0) for k in FEATURE_ORDER}
    # Normalise winner to the integer encoding used by generate_synthetic_battles.py:
    # 0 = A wins, 1 = B wins — keeps the CSV format consistent for re-reads.
    raw_winner = new_battle.get("winner", "A")
    if isinstance(raw_winner, str):
        row["winner"] = 0 if raw_winner.upper() == "A" else 1
    else:
        row["winner"] = int(raw_winner)

    # Append to CSV
    file_exists = DEFAULT_BATTLES_CSV.exists()
    with open(DEFAULT_BATTLES_CSV, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FEATURE_ORDER + ["winner"])
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)

    logger.info("Appended ground truth battle to %s", DEFAULT_BATTLES_CSV)
    return train(str(DEFAULT_BATTLES_CSV))


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

def predict(team_a_data: list[dict], team_b_data: list[dict]) -> dict:
    """
    Predict battle outcome between two teams.

    Returns
    -------
    {
      predicted_winner: 'A' or 'B',
      confidence: float,
      reason: str,
      model_votes: {'dt': 'A', 'rf': 'A', ...},
      features_used: dict,
    }
    """
    models = get_models()
    features = build_features(team_a_data, team_b_data)
    fv = features_to_vector(features)

    votes: dict[str, str] = {}
    probas: dict[str, float] = {}

    for key, model in models.items():
        pred = int(model.predict(fv)[0])
        winner = "A" if pred == 1 else "B"
        votes[key] = winner

        if hasattr(model, "predict_proba"):
            proba_all = model.predict_proba(fv)[0]
            classes = list(model.classes_)
            proba_a = float(proba_all[classes.index(1)]) if 1 in classes else 0.5
        else:
            proba_a = 1.0 if pred == 1 else 0.0
        probas[key] = proba_a

    # Majority vote
    a_votes = sum(1 for v in votes.values() if v == "A")
    b_votes = len(votes) - a_votes
    majority_winner = "A" if a_votes >= b_votes else "B"

    # Weighted confidence
    total_weight = sum(MODEL_WEIGHTS.values())
    weighted_proba_a = sum(probas[k] * MODEL_WEIGHTS.get(k, 0.2) for k in MODEL_KEYS) / total_weight
    confidence = weighted_proba_a if majority_winner == "A" else (1.0 - weighted_proba_a)

    reason = _build_battle_reason(features, majority_winner)

    return {
        "predicted_winner": majority_winner,
        "confidence": round(float(confidence), 4),
        "reason": reason,
        "model_votes": votes,
        "features_used": {k: round(float(v), 4) for k, v in features.items()},
    }


def _build_battle_reason(features: dict, winner: str) -> str:
    """Describe the top 3 feature advantages for the predicted winner."""
    sign = 1.0 if winner == "A" else -1.0
    # For features named *_adv, positive means A is ahead
    # For role_balance_a, 1 means A has all roles
    scored: list[tuple[str, float]] = []
    for k, v in features.items():
        impact = float(v) * sign
        scored.append((k, impact))
    scored.sort(key=lambda x: x[1], reverse=True)

    top_3 = [f"{k.replace('_adv', '').replace('_', ' ')} advantage" for k, v in scored[:3] if v > 0]
    if top_3:
        return f"Team {winner} wins due to: {', '.join(top_3)}."
    return f"Team {winner} predicted to win (narrow margin)."


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def get_metrics() -> dict:
    """Evaluate all models on a held-out synthetic test set and return metrics."""
    if DEFAULT_BATTLES_CSV.exists():
        try:
            df = pd.read_csv(DEFAULT_BATTLES_CSV)
            required = set(FEATURE_ORDER + ["winner"])
            if required <= set(df.columns):
                X = df[FEATURE_ORDER].values.astype(float)
                # CSV stores winner as 0 (A wins) / 1 (B wins) integers from the pipeline,
                # or as "A"/"B" strings when ground-truth rows are appended.
                # Normalise both encodings to: 1 = A wins, 0 = B wins.
                raw_winner = df["winner"]
                if raw_winner.dtype == object or raw_winner.dtype.kind in ("U", "S"):
                    y = (raw_winner.str.upper() == "A").astype(int).values
                else:
                    y = (raw_winner.astype(int) == 0).astype(int).values
                _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
            else:
                X_test, y_test = _generate_synthetic_data(n_samples=400)
        except Exception:
            X_test, y_test = _generate_synthetic_data(n_samples=400)
    else:
        X_test, y_test = _generate_synthetic_data(n_samples=400)

    models = get_models()
    return _compute_metrics(models, X_test, y_test)


def _compute_metrics(models: dict[str, Any], X_test: np.ndarray, y_test: np.ndarray) -> dict:
    """Compute ensemble and per-model metrics on a test set."""
    # Ensemble predictions
    all_preds = []
    all_probas_a = []
    for key in MODEL_KEYS:
        model = models[key]
        preds = model.predict(X_test)
        all_preds.append(preds)
        if hasattr(model, "predict_proba"):
            pa = model.predict_proba(X_test)
            classes = list(model.classes_)
            if 1 in classes:
                all_probas_a.append(pa[:, classes.index(1)])
            else:
                all_probas_a.append(np.zeros(len(X_test)))
        else:
            all_probas_a.append(preds.astype(float))

    # Majority vote ensemble
    votes_matrix = np.stack(all_preds, axis=1)
    ensemble_preds = (votes_matrix.sum(axis=1) >= (len(MODEL_KEYS) / 2)).astype(int)

    # Weighted probability ensemble
    weights = np.array([MODEL_WEIGHTS.get(k, 0.2) for k in MODEL_KEYS])
    weights_norm = weights / weights.sum()
    probas_matrix = np.stack(all_probas_a, axis=1)
    ensemble_proba = (probas_matrix * weights_norm).sum(axis=1)

    acc = float(accuracy_score(y_test, ensemble_preds))
    prec = float(precision_score(y_test, ensemble_preds, zero_division=0))
    rec = float(recall_score(y_test, ensemble_preds, zero_division=0))
    f1 = float(f1_score(y_test, ensemble_preds, zero_division=0))

    # Brier score and log loss from ensemble proba
    brier = float(brier_score_loss(y_test, ensemble_proba))
    ll = float(log_loss(y_test, ensemble_proba))

    # Confusion matrix
    cm = confusion_matrix(y_test, ensemble_preds)
    tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0, 0, 0, int(np.sum(ensemble_preds)))

    per_model: dict[str, float] = {}
    for i, key in enumerate(MODEL_KEYS):
        per_model[f"{key}_accuracy"] = float(accuracy_score(y_test, all_preds[i]))

    return {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "brier_score": round(brier, 4),
        "log_loss": round(ll, 4),
        "confusion_matrix": {"tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn)},
        "per_model": per_model,
        "n_test_samples": len(y_test),
    }


# ---------------------------------------------------------------------------
# Synthetic data generator (used when CSV is missing)
# ---------------------------------------------------------------------------

def _generate_synthetic_data(n_samples: int = 2000) -> tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic battle data.
    Positive label (A wins) is correlated with positive feature values.
    """
    rng = np.random.default_rng(42)
    X = rng.normal(0, 50, size=(n_samples, len(FEATURE_ORDER)))

    linear_score = (
        0.25 * X[:, 1] / 300.0   # stat_adv normalised
        + 0.25 * X[:, 10] / 2.0  # matchup_adv (range ~[-3,3])
        + 0.20 * X[:, 0] / 50.0  # speed_adv
        + 0.15 * X[:, 12] / 3.0  # dmg_matchup_adv
        + 0.10 * X[:, 11] / 4.0  # speed_control_adv (range ~[-4,4])
        + 0.10 * X[:, 2]          # coverage_adv
        + 0.08 * X[:, 3] / 10.0  # weakness_adv
        + 0.05 * X[:, 9]          # role_balance_a
        + rng.normal(0, 0.3, n_samples)
    )
    y = (linear_score > 0).astype(int)
    return X, y


# ---------------------------------------------------------------------------
# Startup check — auto-train if models are missing
# ---------------------------------------------------------------------------

def ensure_models_loaded() -> None:
    """Called at FastAPI startup. Trains models if not already persisted."""
    global _model_cache
    if _model_cache:
        return
    loaded = _load_models()
    if loaded is not None:
        _model_cache = loaded
        logger.info("Engine 3 models loaded from disk.")
        return
    logger.info("Engine 3 models not found. Auto-training on synthetic data...")
    train()
    logger.info("Engine 3 auto-training complete.")
