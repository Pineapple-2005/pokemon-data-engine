"""
FastAPI routes for Engine 2 — Counter-Pick Engine.
POST /engine2/counter
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from ml.api.schemas.request_schemas import Engine2Request, Engine2Response
from ml.engines.engine2_counter_pick import generate_counter_team

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/engine2", tags=["Engine 2 — Counter-Pick Engine"])


@router.post(
    "/counter",
    response_model=Engine2Response,
    summary="Generate a counter-pick team",
    description=(
        "Scores each Pokémon in the assigned pool against the opponent team "
        "using TCS, SAS, K-NN, and Decision Tree probabilities. "
        "Returns the top 6 counter picks with score breakdowns and a matchup table. "
        "Stateless — all data must be supplied in the request body."
    ),
)
async def generate_counter(request: Engine2Request) -> Engine2Response:
    try:
        opponent_data_dicts = [p.model_dump() for p in request.opponent_data]
        assigned_pool_dicts = [p.model_dump() for p in request.assigned_pool]

        result = generate_counter_team(
            opponent_team_names=request.opponent_team,
            opponent_data=opponent_data_dicts,
            assigned_pool=assigned_pool_dicts,
        )

        # Coerce matchup_table entries into MatchupEntry-compatible dicts
        # (they're already plain dicts from the engine)
        return Engine2Response(**result)

    except ValueError as exc:
        logger.warning("Engine 2 validation error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Engine 2 unexpected error")
        raise HTTPException(status_code=500, detail=f"Engine 2 error: {exc}")
