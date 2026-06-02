"""
Pokemon ML Engine API — FastAPI entry point
============================================
Exposes three ML engines as HTTP microservice endpoints.
Called by NestJS (port 3001); this service runs on port 8000.

Startup behaviour:
  • Engine 3 auto-trains if model files are missing from ml/models/
  • All engines are stateless — Pokémon data is passed in each request body
  • FastAPI never connects to the database directly

Run locally:
    cd ml && uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import logging
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

# ---------------------------------------------------------------------------
# Path bootstrap — ensure the datamining/ project root is on sys.path so that
# `from ml.api.routes import ...` resolves regardless of the working directory
# (handles both `cd ml && uvicorn api.main:app` and `cd .. && uvicorn ml.api.main:app`)
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parents[2]   # datamining/
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ml.api.routes import engine1, engine2, engine3
from ml.engines.engine3_battle_predictor import ensure_models_loaded, MODEL_FILE_MAP

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — runs once at startup and once at shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup: ensure Engine 3 models are trained and in memory."""
    logger.info("Pokemon ML Engine API starting up...")
    try:
        ensure_models_loaded()
        logger.info("Engine 3 models ready.")
    except Exception as exc:
        logger.error("Engine 3 startup failed: %s — predictions will return 503 until trained.", exc)
    yield
    logger.info("Pokemon ML Engine API shutting down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Pokemon ML Engine API",
    version="1.0.0",
    description=(
        "Three scikit-learn powered ML engines for Pokémon team building:\n\n"
        "- **Engine 1** — Gym Leader Team Generator (K-Means + DT + RF + Cosine + Gower)\n"
        "- **Engine 2** — Counter-Pick Engine (TCS + KNN + DT scoring)\n"
        "- **Engine 3** — Battle Predictor (5-model ensemble, online retraining)\n\n"
        "All endpoints are **stateless** — Pokémon data is supplied in each request body by NestJS."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS — allow NestJS backend on port 3001
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request timing middleware (lightweight observability)
# ---------------------------------------------------------------------------

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.1f}"
    logger.info("%s %s — %.1fms — %d", request.method, request.url.path, elapsed_ms, response.status_code)
    return response


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(engine1.router)
app.include_router(engine2.router)
app.include_router(engine3.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Health"], summary="Service health check")
async def health_check() -> dict:
    """
    Returns service status and whether Engine 3 models are loaded in memory.
    NestJS polls this before sending prediction requests.
    """
    models_loaded = all(path.exists() for path in MODEL_FILE_MAP.values())
    return {
        "status": "ok",
        "models_loaded": models_loaded,
        "version": "1.0.0",
    }


# ---------------------------------------------------------------------------
# Global exception handler — ensures all unhandled errors return JSON
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
    )
