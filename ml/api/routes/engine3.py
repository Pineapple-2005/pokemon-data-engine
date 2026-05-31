"""
FastAPI routes for Engine 3 — Battle Predictor.

POST  /engine3/predict   — predict winner of a team-vs-team battle
POST  /engine3/train     — (re)train all 5 models from a battles CSV
POST  /engine3/retrain   — append one ground-truth result and retrain
GET   /engine3/metrics   — return evaluation metrics from the test set
"""

from __future__ import annotations

import logging
import os
import sqlite3

from fastapi import APIRouter, HTTPException

from ml.api.schemas.request_schemas import (
    Engine3PredictRequest,
    Engine3PredictResponse,
    Engine3TrainRequest,
    TrainingMetrics,
    GroundTruthBattle,
    RetrainResult,
    ModelMetrics,
    ConfusionMatrix,
)
from ml.engines.engine3_battle_predictor import (
    predict,
    train,
    retrain_with_ground_truth,
    get_metrics,
    _ML_ROOT,
)
from ml.utils.feature_builder import build_team_features as _build_features

logger = logging.getLogger(__name__)

_DB_PATH = (_ML_ROOT / os.getenv("DB_PATH", "../pokemon.db")).resolve()


def _load_pokemon_by_names(names: list[str]) -> list[dict]:
    """Look up Pokémon dicts from the SQLite DB by name (case-insensitive)."""
    if not _DB_PATH.exists() or not names:
        return []
    name_set = {n.lower() for n in names}
    try:
        conn = sqlite3.connect(str(_DB_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pokemon")
        rows = [dict(r) for r in cursor.fetchall() if r["name"].lower() in name_set]
        conn.close()
        return rows
    except Exception as exc:
        logger.warning("DB lookup failed in retrain route: %s", exc)
        return []

router = APIRouter(prefix="/engine3", tags=["Engine 3 — Battle Predictor"])


@router.post(
    "/predict",
    response_model=Engine3PredictResponse,
    summary="Predict battle outcome",
    description=(
        "Runs a 5-model ensemble (DT, RF, LR, NB, KNN) with majority vote "
        "and weighted confidence to predict which team wins. "
        "Models must be trained before this endpoint is called; they are "
        "auto-trained on startup if model files are missing."
    ),
)
async def predict_battle(request: Engine3PredictRequest) -> Engine3PredictResponse:
    try:
        team_a = [p.model_dump() for p in request.team_a_data]
        team_b = [p.model_dump() for p in request.team_b_data]

        result = predict(team_a, team_b)

        return Engine3PredictResponse(
            **result,
            battler_a=request.battler_a,
            battler_b=request.battler_b,
        )

    except RuntimeError as exc:
        # Models not yet trained — surface as 503 so NestJS can retry
        logger.error("Engine 3 predict — models not ready: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        logger.warning("Engine 3 predict validation error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Engine 3 predict unexpected error")
        raise HTTPException(status_code=500, detail=f"Engine 3 predict error: {exc}")


@router.post(
    "/train",
    response_model=TrainingMetrics,
    summary="Train all models from a battles CSV",
    description=(
        "Loads the battles CSV at the given path (or the default "
        "data/processed/synthetic_battles.csv), trains all 5 models, "
        "saves them to ml/models/, and returns accuracy metrics."
    ),
)
async def train_models(request: Engine3TrainRequest) -> TrainingMetrics:
    try:
        result = train(battles_csv_path=request.battles_csv_path)
        return TrainingMetrics(**result)
    except Exception as exc:
        logger.exception("Engine 3 train error")
        raise HTTPException(status_code=500, detail=f"Training error: {exc}")


@router.post(
    "/retrain",
    response_model=RetrainResult,
    summary="Append a ground-truth battle and retrain",
    description=(
        "Appends one real battle result (with precomputed differential features "
        "and the actual winner) to the training CSV, then retrains all models. "
        "Use this for online learning as real match data accumulates."
    ),
)
async def retrain_with_result(battle: GroundTruthBattle) -> RetrainResult:
    try:
        data = battle.model_dump(exclude={"match_id", "team_a", "team_b"})

        # NestJS format: compute features from team names via DB lookup
        if battle.team_a and battle.team_b:
            team_a_data = _load_pokemon_by_names(battle.team_a)
            team_b_data = _load_pokemon_by_names(battle.team_b)
            if team_a_data and team_b_data:
                features = _build_features(team_a_data, team_b_data)
                data.update(features)
                logger.info(
                    "Retrain: computed features from DB for teams %s vs %s",
                    battle.team_a, battle.team_b,
                )
            else:
                logger.warning(
                    "Retrain: DB lookup returned no data for teams %s / %s — using zero features",
                    battle.team_a, battle.team_b,
                )

        result = retrain_with_ground_truth(data)
        return RetrainResult(**result)
    except Exception as exc:
        logger.exception("Engine 3 retrain error")
        raise HTTPException(status_code=500, detail=f"Retrain error: {exc}")


@router.get(
    "/metrics",
    response_model=ModelMetrics,
    summary="Get current model evaluation metrics",
    description=(
        "Evaluates the ensemble on a held-out test split of the battles CSV "
        "(or a synthetic test set if the CSV is unavailable). "
        "Returns accuracy, precision, recall, F1, Brier score, log loss, "
        "confusion matrix, and per-model accuracy."
    ),
)
async def model_metrics() -> ModelMetrics:
    try:
        metrics = get_metrics()
        cm_raw = metrics.pop("confusion_matrix")
        return ModelMetrics(
            **metrics,
            confusion_matrix=ConfusionMatrix(**cm_raw),
        )
    except RuntimeError as exc:
        logger.error("Engine 3 metrics — models not ready: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Engine 3 metrics error")
        raise HTTPException(status_code=500, detail=f"Metrics error: {exc}")
