"""
Pydantic request and response schemas for all three ML engines.
All models use Pydantic v2 (model_config, field validators).
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Shared — Pokémon dict that NestJS sends for any engine
# ---------------------------------------------------------------------------

class PokemonData(BaseModel):
    """Full Pokémon record as enriched and sent by NestJS."""

    name: str
    type_1: Optional[str] = None
    type_2: Optional[str] = None

    # Raw stats
    hp: Optional[float] = None
    attack: Optional[float] = None
    defense: Optional[float] = None
    sp_atk: Optional[float] = None
    sp_def: Optional[float] = None
    speed: Optional[float] = None
    total_base_stats: Optional[float] = None
    total: Optional[float] = None          # alias some pipelines send

    # Scaled stats (0-1) — may be present after pipeline processing
    hp_scaled: Optional[float] = None
    attack_scaled: Optional[float] = None
    defense_scaled: Optional[float] = None
    sp_atk_scaled: Optional[float] = None
    sp_def_scaled: Optional[float] = None
    speed_scaled: Optional[float] = None

    # Classification labels
    role_label: Optional[str] = None
    is_assigned: Optional[int] = None

    model_config = {"extra": "allow"}   # pass-through unknown fields from NestJS

    @model_validator(mode="before")
    @classmethod
    def normalize_nestjs_fields(cls, data: Any) -> Any:
        """
        NestJS sends `special_attack` / `special_defense` / `special_attack_scaled` /
        `special_defense_scaled` but the ML engines expect the shorter `sp_atk` / `sp_def`
        aliases.  Map them here so both naming conventions are accepted transparently.
        """
        if not isinstance(data, dict):
            return data
        mapping = {
            "special_attack":         "sp_atk",
            "special_defense":        "sp_def",
            "special_attack_scaled":  "sp_atk_scaled",
            "special_defense_scaled": "sp_def_scaled",
        }
        for nestjs_key, internal_key in mapping.items():
            if nestjs_key in data and internal_key not in data:
                data[internal_key] = data[nestjs_key]
        return data


# ===========================================================================
# ENGINE 1 — Gym Leader Team Generator
# ===========================================================================

class Engine1Request(BaseModel):
    theme: str = Field(..., description="One of the 18 Pokémon types or 'balanced'")
    difficulty: str = Field("medium", description="easy | medium | hard")
    pokemon_pool: list[PokemonData] = Field(..., min_length=1)

    @field_validator("theme")
    @classmethod
    def theme_must_be_valid(cls, v: str) -> str:
        valid = {
            "normal", "fire", "water", "electric", "grass", "ice",
            "fighting", "poison", "ground", "flying", "psychic", "bug",
            "rock", "ghost", "dragon", "dark", "steel", "fairy", "balanced",
        }
        if v.lower() not in valid:
            raise ValueError(f"theme '{v}' is not a valid Pokémon type or 'balanced'")
        return v.lower()

    @field_validator("difficulty")
    @classmethod
    def difficulty_must_be_valid(cls, v: str) -> str:
        valid = {"easy", "medium", "hard"}
        if v.lower() not in valid:
            raise ValueError(f"difficulty must be easy, medium, or hard; got '{v}'")
        return v.lower()


class TeamSlot(BaseModel):
    slot: int
    role: str
    name: str
    type_1: Optional[str] = None
    type_2: Optional[str] = None
    total_base_stats: int
    usefulness_score: float
    reason: str


class Engine1Metrics(BaseModel):
    silhouette_score: float
    cluster_count: int
    pool_size: int


class Engine1Response(BaseModel):
    theme: str
    difficulty: str
    team: list[TeamSlot]
    model_used: str
    metrics: Engine1Metrics
    explanation: str


# ===========================================================================
# ENGINE 2 — Counter-Pick Engine
# ===========================================================================

class Engine2Request(BaseModel):
    opponent_team: list[str] = Field(
        ..., min_length=1, max_length=4,
        description="List of opponent Pokémon names"
    )
    opponent_data: list[PokemonData] = Field(
        ..., min_length=1,
        description="Full Pokémon dicts for the opponent team"
    )
    assigned_pool: list[PokemonData] = Field(
        ..., min_length=0,
        description="Only is_assigned=1 Pokémon from NestJS"
    )


class ScoreBreakdown(BaseModel):
    tcs: float = Field(..., description="Type Coverage Score")
    sas: float = Field(..., description="Stat Advantage Score (raw, -1..1)")
    rs: float = Field(..., description="Resistance Score")
    knn: float = Field(..., description="KNN strong-counter probability (1v1-sim label)")
    dt: float = Field(..., description="Decision Tree strong-counter probability (1v1-sim label)")
    vulnerability: float = Field(0.0, description="Fraction of opponents that dominate C (penalty term)")


class CounterRecommendation(BaseModel):
    rank: int
    name: str
    counter_score: float
    score_breakdown: ScoreBreakdown
    type_1: Optional[str] = None
    type_2: Optional[str] = None
    total_base_stats: int
    reason: str


class MatchupEntry(BaseModel):
    advantage: str   # "super effective" | "not very effective" | "immune" | "neutral"
    multiplier: float


class Engine2Response(BaseModel):
    opponent_team: list[str]
    recommended_team: list[CounterRecommendation]
    model_used: str
    matchup_table: dict[str, MatchupEntry]


# ===========================================================================
# ENGINE 3 — Battle Predictor
# ===========================================================================

class Engine3PredictRequest(BaseModel):
    """
    battler_a / battler_b are optional name labels for logging.
    team_a_data / team_b_data are the full Pokémon dicts for each team.
    """
    battler_a: Optional[str] = Field(None, description="Label for Team A (e.g. trainer name)")
    battler_b: Optional[str] = Field(None, description="Label for Team B")
    team_a_data: list[PokemonData] = Field(..., min_length=1, max_length=4)
    team_b_data: list[PokemonData] = Field(..., min_length=1, max_length=4)


class Engine3PredictResponse(BaseModel):
    predicted_winner: str          # 'A' or 'B'
    confidence: float              # 0.0 – 1.0 from weighted ensemble
    reason: str
    model_votes: dict[str, str]    # {'dt': 'A', 'rf': 'A', ...}
    features_used: dict[str, float]
    battler_a: Optional[str] = None
    battler_b: Optional[str] = None


class Engine3TrainRequest(BaseModel):
    battles_csv_path: Optional[str] = Field(
        None,
        description="Absolute path to synthetic_battles.csv. Uses default path if omitted."
    )


class TrainingMetrics(BaseModel):
    status: str
    train_size: int
    test_size: int
    metrics: dict[str, Any]


class GroundTruthBattle(BaseModel):
    """
    A single real battle result used for online retraining.

    Accepts two formats:
    - NestJS format: {winner, team_a, team_b} — Python looks up stats from DB and computes features.
    - Direct format: all 13 differential features + winner — used for direct API calls.

    winner must always be 'A' or 'B'.
    """
    # Required in both formats
    winner: str = Field(..., description="'A' or 'B'")

    # NestJS format — Pokémon name lists for DB lookup + feature computation
    match_id: Optional[str] = None
    team_a: Optional[list[str]] = Field(None, description="Pokémon names for team A (triggers DB lookup)")
    team_b: Optional[list[str]] = Field(None, description="Pokémon names for team B")

    # Pre-computed features (all default 0.0; used when team_a/team_b not provided)
    speed_adv: float = 0.0
    stat_adv: float = 0.0
    coverage_adv: float = 0.0
    weakness_adv: float = 0.0
    hp_adv: float = 0.0
    atk_adv: float = 0.0
    sp_atk_adv: float = 0.0
    def_adv: float = 0.0
    type_diversity_adv: float = 0.0
    role_balance_a: float = 0.0
    matchup_adv: float = 0.0
    speed_control_adv: float = 0.0
    dmg_matchup_adv: float = 0.0

    @field_validator("winner")
    @classmethod
    def winner_must_be_valid(cls, v: str) -> str:
        if v.upper() not in {"A", "B"}:
            raise ValueError("winner must be 'A' or 'B'")
        return v.upper()


class RetrainResult(BaseModel):
    status: str
    train_size: int
    test_size: int
    metrics: dict[str, Any]


class ConfusionMatrix(BaseModel):
    tp: int
    fp: int
    tn: int
    fn: int


class ModelMetrics(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1: float
    brier_score: float
    log_loss: float
    confusion_matrix: ConfusionMatrix
    per_model: dict[str, float]
    n_test_samples: int
