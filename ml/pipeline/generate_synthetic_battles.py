"""
Synthetic battle data generator for Engine 3 cold-start training.

Generates N simulated team-vs-team battles using a deterministic scoring formula
with a small random component. Output is saved as a CSV for the ML model to train on.

Usage:
    python pipeline/generate_synthetic_battles.py
    python pipeline/generate_synthetic_battles.py --n-battles 1000
    python pipeline/generate_synthetic_battles.py --db-path ../pokemon.db --n-battles 500

Output: data/processed/synthetic_battles.csv

Columns:
    speed_adv, stat_adv, coverage_adv, weakness_adv, hp_adv, atk_adv,
    sp_atk_adv, def_adv, type_diversity_adv, role_balance_a, matchup_adv,
    speed_control_adv, dmg_matchup_adv, winner
    (winner: 0 = team A wins, 1 = team B wins)
"""

import argparse
import logging
import random
import sqlite3
import sys
import time
from pathlib import Path

import pandas as pd

from dotenv import load_dotenv
import os

# Load .env from ml/
_ML_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_ML_DIR / ".env")

sys.path.insert(0, str(_ML_DIR))

from utils.feature_builder import (
    build_team_features,
    get_team_type_coverage,
    _team_matchup_score,
    _speed_control,
    _dmg_matchup,
)

logger = logging.getLogger(__name__)

# Team size for each simulated battle
TEAM_SIZE = 4


# ---------------------------------------------------------------------------
# Battle simulation
# ---------------------------------------------------------------------------

def generate_battle(team_a: list[dict], team_b: list[dict]) -> dict:
    """
    Simulate a battle between two teams using a deterministic scoring formula.

    Score formula (positive = team A wins):
        0.25 * stat + 0.20 * dmg_matchup + 0.15 * matchup
      + 0.15 * speed_control + 0.10 * coverage + 0.05 * speed + 0.10 * random

    Args:
        team_a: List of Pokémon feature dicts for team A (must have total_base_stats, speed, type_1/2).
        team_b: List of Pokémon feature dicts for team B.

    Returns:
        Dict with 13 feature columns + 'winner' (0 = A wins, 1 = B wins).
    """
    def safe_avg(team: list[dict], key: str) -> float:
        vals = [v for p in team if (v := p.get(key)) is not None]
        return sum(vals) / len(vals) if vals else 0.0

    avg_total_a = safe_avg(team_a, "total_base_stats")
    avg_total_b = safe_avg(team_b, "total_base_stats")
    avg_speed_a = safe_avg(team_a, "speed")
    avg_speed_b = safe_avg(team_b, "speed")
    coverage_a  = get_team_type_coverage(team_a)
    coverage_b  = get_team_type_coverage(team_b)

    matchup       = _team_matchup_score(team_a, team_b) - _team_matchup_score(team_b, team_a)
    speed_control = _speed_control(team_a, team_b) - _speed_control(team_b, team_a)
    dmg_matchup   = _dmg_matchup(team_a, team_b) - _dmg_matchup(team_b, team_a)

    score = (
        0.25 * (avg_total_a - avg_total_b) / 600.0
        + 0.20 * dmg_matchup / 3.0
        + 0.15 * matchup / 2.0
        + 0.15 * speed_control / 4.0
        + 0.10 * (coverage_a - coverage_b) / 18.0
        + 0.05 * (avg_speed_a - avg_speed_b) / 130.0
        + 0.10 * random.uniform(-1.0, 1.0)
    )

    winner = 0 if score > 0 else 1  # 0 = A wins, 1 = B wins

    # Build differential feature dict
    features = build_team_features(team_a, team_b)
    features["winner"] = winner

    return features


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _load_all_pokemon(db_path: str) -> list[dict]:
    """
    Load all Pokémon records from the database into a list of feature dicts.

    Joins pokemon + scaled_stats + type_matchups to provide a full feature set
    for each Pokémon in the battle simulation.

    Args:
        db_path: Path to the SQLite database.

    Returns:
        List of dicts, one per Pokémon.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    try:
        cursor = conn.cursor()
        # Check what tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}

        if "pokemon" not in tables:
            logger.error("pokemon table not found in %s — run the pipeline first", db_path)
            return []

        # Base query against pokemon table
        cursor.execute("SELECT * FROM pokemon")
        rows = [dict(row) for row in cursor.fetchall()]

        # Attempt to enrich with type_matchup columns if the table exists
        if "type_matchups" in tables:
            cursor.execute("SELECT * FROM type_matchups")
            matchup_rows = {row["name"]: dict(row) for row in cursor.fetchall()}
            for poke in rows:
                matchup = matchup_rows.get(poke["name"], {})
                poke.update({k: v for k, v in matchup.items() if k != "name"})

        logger.info("Loaded %d Pokémon from database", len(rows))
        return rows

    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

def run_generation(
    db_path: str = "../pokemon.db",
    n_battles: int = 500,
    output_path: str | None = None,
    seed: int = 42,
) -> None:
    """
    Generate N synthetic battle records and save to CSV.

    Args:
        db_path:     Path to the SQLite database.
        n_battles:   Number of battles to simulate.
        output_path: Where to save the CSV. Defaults to data/processed/synthetic_battles.csv.
        seed:        Random seed for reproducibility.
    """
    random.seed(seed)

    # Resolve paths
    db_file = (_ML_DIR / db_path).resolve()
    if not db_file.exists():
        print(f"ERROR: Database not found at {db_file}. Run run_pipeline.py first.")
        sys.exit(1)

    if output_path is None:
        out_file = _ML_DIR / "data" / "processed" / "synthetic_battles.csv"
    else:
        out_file = Path(output_path)

    out_file.parent.mkdir(parents=True, exist_ok=True)

    # Load all Pokémon
    all_pokemon = _load_all_pokemon(str(db_file))
    if len(all_pokemon) < TEAM_SIZE * 2:
        print(f"ERROR: Need at least {TEAM_SIZE * 2} Pokémon in the DB, found {len(all_pokemon)}.")
        sys.exit(1)

    print(f"Generating {n_battles} synthetic battles from {len(all_pokemon)} Pokémon...")

    records: list[dict] = []
    t0 = time.perf_counter()

    for i in range(n_battles):
        # Sample two non-overlapping teams of TEAM_SIZE
        sample = random.sample(all_pokemon, TEAM_SIZE * 2)
        team_a = sample[:TEAM_SIZE]
        team_b = sample[TEAM_SIZE:]

        battle_record = generate_battle(team_a, team_b)
        records.append(battle_record)

        if (i + 1) % 100 == 0:
            elapsed = time.perf_counter() - t0
            print(f"  Progress: {i + 1}/{n_battles} battles ({elapsed:.1f}s)")

    # Build and validate DataFrame
    df = pd.DataFrame(records)

    # Enforce column order
    output_columns = [
        "speed_adv", "stat_adv", "coverage_adv", "weakness_adv",
        "hp_adv", "atk_adv", "sp_atk_adv", "def_adv",
        "type_diversity_adv", "role_balance_a", "matchup_adv",
        "speed_control_adv", "dmg_matchup_adv", "winner",
    ]
    for col in output_columns:
        if col not in df.columns:
            logger.warning("Expected column %r missing from battle records — filling with 0", col)
            df[col] = 0

    df = df[output_columns]

    # Round continuous features to 4 decimal places
    float_cols = [c for c in output_columns if c != "winner"]
    df[float_cols] = df[float_cols].round(4)

    total_elapsed = time.perf_counter() - t0
    a_wins = (df["winner"] == 0).sum()
    b_wins = (df["winner"] == 1).sum()

    df.to_csv(out_file, index=False)

    print(f"\nGeneration complete in {total_elapsed:.1f}s")
    print(f"  Battles:  {n_battles}")
    print(f"  A wins:   {a_wins} ({100 * a_wins / n_battles:.1f}%)")
    print(f"  B wins:   {b_wins} ({100 * b_wins / n_battles:.1f}%)")
    print(f"  Output:   {out_file}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate synthetic battle training data for Engine 3"
    )
    parser.add_argument(
        "--db-path",
        type=str,
        default=os.getenv("DB_PATH", "../pokemon.db"),
        help="Path to the SQLite database",
    )
    parser.add_argument(
        "--n-battles",
        type=int,
        default=500,
        help="Number of battles to generate (default: 500)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output CSV path (default: data/processed/synthetic_battles.csv)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    args = _parse_args()
    run_generation(
        db_path=args.db_path,
        n_battles=args.n_battles,
        output_path=args.output,
        seed=args.seed,
    )
