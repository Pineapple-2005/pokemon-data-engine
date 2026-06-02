"""
FastAPI routes for Engine 1 — Gym Leader Team Generator.
POST /engine1/generate
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from ml.api.schemas.request_schemas import Engine1Request, Engine1Response
from ml.engines.engine1_gym_leader import generate_team

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/engine1", tags=["Engine 1 — Gym Leader Team Generator"])


@router.post(
    "/generate",
    response_model=Engine1Response,
    summary="Generate a Gym Leader team",
    description=(
        "Builds a themed 6-Pokémon team using K-Means, Decision Tree, "
        "Random Forest, cosine similarity, and Gower diversity. "
        "All Pokémon data must be supplied in the request body — "
        "this endpoint is stateless and does not connect to the database."
    ),
)
async def generate_gym_leader_team(request: Engine1Request) -> Engine1Response:
    try:
        # Convert Pydantic models to plain dicts so engine receives dicts
        pool_dicts = [p.model_dump() for p in request.pokemon_pool]

        # Use the resolved themes list (always non-empty after model_validator).
        # Single-theme legacy calls produce themes=["steel"] — engine handles both.
        result = generate_team(
            themes=request.themes if request.themes else [request.theme],
            difficulty=request.difficulty,
            pokemon_pool=pool_dicts,
            previous_team=request.previous_team,
            previous_lineups=request.previous_lineups,
            variation_seed=request.variation_seed,
        )
        return Engine1Response(**result)

    except ValueError as exc:
        logger.warning("Engine 1 validation error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Engine 1 unexpected error")
        raise HTTPException(status_code=500, detail=f"Engine 1 error: {exc}")
