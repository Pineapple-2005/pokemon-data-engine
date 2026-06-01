"""
Pipeline orchestrator — runs Extract → Transform → Load in sequence.

Usage:
    python pipeline/run_pipeline.py
    python pipeline/run_pipeline.py --limit 151
    python pipeline/run_pipeline.py --region johto
    python pipeline/run_pipeline.py --region all
    python pipeline/run_pipeline.py --limit 151 --db-path ../pokemon.db
"""

import argparse
import logging
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
import os

# Load .env from the ml/ directory (one level above pipeline/)
_ML_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_ML_DIR / ".env")

# Add ml/ to sys.path so all sibling imports work
sys.path.insert(0, str(_ML_DIR))

from pipeline.extract import run_extraction
from pipeline.transform import run_transform
from pipeline.load import run_load
from utils.name_normalizer import load_assigned_csv

# ---------------------------------------------------------------------------
# Region → (offset, limit) mapping
# ---------------------------------------------------------------------------

REGION_RANGES: dict[str, tuple[int, int]] = {
    "kanto":  (0,   151),
    "johto":  (151, 100),
    "hoenn":  (251, 135),
    "sinnoh": (386, 107),
    "unova":  (493, 156),
    "kalos":  (649,  72),
    "alola":  (721,  88),
    "galar":  (809,  96),
    "paldea": (905, 120),
}


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def _configure_logging(log_dir: Path) -> None:
    """Set up console + file logging for the orchestrator."""
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "pipeline.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(log_path, encoding="utf-8"),
        ],
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PokéAPI data pipeline: Extract → Transform → Load"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=int(os.getenv("GEN_LIMIT", "151")),
        help="Number of Pokémon to fetch (default: 151 from .env GEN_LIMIT)",
    )
    parser.add_argument(
        "--db-path",
        type=str,
        default=os.getenv("DB_PATH", "../pokemon.db"),
        help="Path to the SQLite database (default: ../pokemon.db from .env DB_PATH)",
    )
    parser.add_argument(
        "--cache-dir",
        type=str,
        default=os.getenv("CACHE_DIR", "./data/raw"),
        help="Root cache directory for raw API JSON (default: ./data/raw)",
    )
    parser.add_argument(
        "--assigned-csv",
        type=str,
        default=os.getenv("ASSIGNED_CSV_PATH", "./data/csv/assigned_pokemon.csv"),
        help="Path to the assigned Pokémon CSV file",
    )
    parser.add_argument(
        "--api-base",
        type=str,
        default=os.getenv("API_BASE_URL", "https://pokeapi.co/api/v2"),
        help="PokéAPI base URL",
    )
    parser.add_argument(
        "--region",
        type=str,
        default=None,
        choices=list(REGION_RANGES.keys()) + ["all"],
        help=(
            "Region to fetch: kanto (1-151), johto (152-251), hoenn (252-386), "
            "sinnoh (387-493), unova (494-649), kalos (650-721), alola (722-809), "
            "galar (810-905), paldea (906-1025), or all. "
            "Overrides --limit when specified."
        ),
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def _run_region(region: str, args: argparse.Namespace, cache_dir: str, db_path: str, assigned_csv: str) -> None:
    """Run the full ETL pipeline for a single named region."""
    logger = logging.getLogger("run_pipeline")
    offset, limit = REGION_RANGES[region]

    print("=" * 60)
    print(f"  Pokemon Data Pipeline — {region.title()}")
    print(f"  IDs:        offset={offset}, limit={limit}")
    print(f"  DB:         {db_path}")
    print(f"  Cache:      {cache_dir}")
    print("=" * 60)

    total_start = time.perf_counter()

    # ------------------------------------------------------------------
    # Step 1: Extract
    # ------------------------------------------------------------------
    print("\n[1/3] EXTRACT — Fetching from PokéAPI...")
    t0 = time.perf_counter()

    pokemon_raw, type_data = run_extraction(
        limit=limit,
        offset=offset,
        cache_dir=cache_dir,
        api_base=args.api_base,
    )

    elapsed = time.perf_counter() - t0
    print(f"      Done: {len(pokemon_raw)} Pokémon, {len(type_data)} types ({elapsed:.1f}s)")

    if not pokemon_raw:
        print(f"ERROR: Extraction returned 0 Pokémon for {region}. Aborting.")
        sys.exit(1)

    # ------------------------------------------------------------------
    # Step 2: Transform
    # ------------------------------------------------------------------
    print("\n[2/3] TRANSFORM — Cleaning and deriving features...")
    t0 = time.perf_counter()

    assigned_names = load_assigned_csv(assigned_csv)
    print(f"      Loaded {len(assigned_names)} assigned Pokémon from CSV")

    df = run_transform(
        pokemon_raw=pokemon_raw,
        type_data=type_data,
        assigned_names=assigned_names,
    )

    elapsed = time.perf_counter() - t0
    print(f"      Done: {len(df)} rows, {len(df.columns)} columns ({elapsed:.1f}s)")

    if df.empty:
        print(f"ERROR: Transform produced empty DataFrame for {region}. Aborting.")
        sys.exit(1)

    # ------------------------------------------------------------------
    # Step 3: Load
    # ------------------------------------------------------------------
    print("\n[3/3] LOAD — Writing to SQLite...")
    t0 = time.perf_counter()

    run_load(df, db_path=db_path)

    elapsed = time.perf_counter() - t0
    print(f"      Done ({elapsed:.1f}s)")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    total_elapsed = time.perf_counter() - total_start
    print("\n" + "=" * 60)
    print(f"  {region.title()} pipeline complete in {total_elapsed:.1f}s")
    print(f"  Database: {db_path}")
    print("=" * 60 + "\n")


def main() -> None:
    args = _parse_args()

    # Resolve paths relative to the ml/ directory.
    # Use Path.resolve() so that "../pokemon.db" correctly traverses up to the
    # project root instead of being mangled by lstrip.
    cache_dir    = str((_ML_DIR / args.cache_dir).resolve())
    db_path      = str((_ML_DIR / args.db_path).resolve())
    assigned_csv = str((_ML_DIR / args.assigned_csv).resolve())
    log_dir      = _ML_DIR / "data" / "logs"

    _configure_logging(log_dir)

    if args.region:
        # Region mode — overrides --limit
        regions_to_run = list(REGION_RANGES.keys()) if args.region == "all" else [args.region]
        for region in regions_to_run:
            _run_region(region, args, cache_dir, db_path, assigned_csv)
        return

    # Legacy mode — use --limit (keeps backward compatibility)
    logger = logging.getLogger("run_pipeline")

    print("=" * 60)
    print("  Pokemon Data Pipeline")
    print(f"  Limit:      {args.limit} Pokémon")
    print(f"  DB:         {db_path}")
    print(f"  Cache:      {cache_dir}")
    print("=" * 60)

    total_start = time.perf_counter()

    # ------------------------------------------------------------------
    # Step 1: Extract
    # ------------------------------------------------------------------
    print("\n[1/3] EXTRACT — Fetching from PokéAPI...")
    t0 = time.perf_counter()

    pokemon_raw, type_data = run_extraction(
        limit=args.limit,
        offset=0,
        cache_dir=cache_dir,
        api_base=args.api_base,
    )

    elapsed = time.perf_counter() - t0
    print(f"      Done: {len(pokemon_raw)} Pokémon, {len(type_data)} types ({elapsed:.1f}s)")

    if not pokemon_raw:
        print("ERROR: Extraction returned 0 Pokémon. Aborting.")
        sys.exit(1)

    # ------------------------------------------------------------------
    # Step 2: Transform
    # ------------------------------------------------------------------
    print("\n[2/3] TRANSFORM — Cleaning and deriving features...")
    t0 = time.perf_counter()

    assigned_names = load_assigned_csv(assigned_csv)
    print(f"      Loaded {len(assigned_names)} assigned Pokémon from CSV")

    df = run_transform(
        pokemon_raw=pokemon_raw,
        type_data=type_data,
        assigned_names=assigned_names,
    )

    elapsed = time.perf_counter() - t0
    print(f"      Done: {len(df)} rows, {len(df.columns)} columns ({elapsed:.1f}s)")

    if df.empty:
        print("ERROR: Transform produced empty DataFrame. Aborting.")
        sys.exit(1)

    # ------------------------------------------------------------------
    # Step 3: Load
    # ------------------------------------------------------------------
    print("\n[3/3] LOAD — Writing to SQLite...")
    t0 = time.perf_counter()

    run_load(df, db_path=db_path)

    elapsed = time.perf_counter() - t0
    print(f"      Done ({elapsed:.1f}s)")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    total_elapsed = time.perf_counter() - total_start
    print("\n" + "=" * 60)
    print(f"  Pipeline complete in {total_elapsed:.1f}s")
    print(f"  Database: {db_path}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
