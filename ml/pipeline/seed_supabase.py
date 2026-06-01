"""
Supabase PostgreSQL seeder — Extract → Transform → Upsert for all 9 generations.

Reads Supabase connection from environment variables (loaded from ml/.env):
    DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

Uses the existing extract.py and transform.py pipeline layers, then upserts
into the `pokemon_data` table using INSERT ... ON CONFLICT (name) DO UPDATE SET.

Usage:
    # From the ml/ directory:
    python -m pipeline.seed_supabase                    # seed all 9 regions
    python -m pipeline.seed_supabase --region kanto     # one region only
    python -m pipeline.seed_supabase --dry-run          # fetch+transform, no DB writes
    python -m pipeline.seed_supabase --region galar --dry-run

    # Or run directly:
    python pipeline/seed_supabase.py --region all
"""

import argparse
import logging
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Path bootstrap — must happen before any local imports
# ---------------------------------------------------------------------------
_ML_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ML_DIR))

from dotenv import load_dotenv
import os

load_dotenv(_ML_DIR / ".env")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("seed_supabase")


# ---------------------------------------------------------------------------
# Region definitions  (offset, limit)
# Same as run_pipeline.py — kept in sync manually.
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
# Column mapping: transform.py output → pokemon_data column names
# ---------------------------------------------------------------------------
# The transform DataFrame uses internal names that differ from the Supabase schema.
# This map is applied before building the INSERT statement.
_RENAME_MAP: dict[str, str] = {
    "pokedex_id": "pokeapi_id",
    "sp_atk":     "special_attack",
    "sp_def":     "special_defense",
}

# Ordered list of columns to write.  Order must match the VALUES(...) placeholders.
# These are the Supabase column names (after renaming).
_POKEMON_DATA_COLS: list[str] = [
    # Identity
    "name",
    "pokeapi_id",
    # Types
    "type_1",
    "type_2",
    # Base stats
    "hp",
    "attack",
    "defense",
    "special_attack",
    "special_defense",
    "speed",
    "total_base_stats",
    # Computed ratios + tiers
    "attack_ratio",
    "special_attack_ratio",
    "speed_tier",
    # Role + assignment
    "role_label",
    "is_assigned",
    # Region metadata
    "native_region",
    "generation",
    "restricted_status",
    # Abilities
    "ability_1",
    "ability_2",
    "hidden_ability",
    # Physical
    "height_dm",
    "weight_hg",
    # Type matchup defensive multipliers (18 columns)
    "def_vs_normal",
    "def_vs_fire",
    "def_vs_water",
    "def_vs_electric",
    "def_vs_grass",
    "def_vs_ice",
    "def_vs_fighting",
    "def_vs_poison",
    "def_vs_ground",
    "def_vs_flying",
    "def_vs_psychic",
    "def_vs_bug",
    "def_vs_rock",
    "def_vs_ghost",
    "def_vs_dragon",
    "def_vs_dark",
    "def_vs_steel",
    "def_vs_fairy",
    # Derived counters
    "weakness_count",
    "resistance_count",
]


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _get_connection():
    """
    Open a psycopg2 connection to Supabase using env vars.
    Requires SSL (sslmode=require) as Supabase enforces TLS.

    Returns:
        psycopg2 connection object.

    Raises:
        SystemExit if required env vars are missing or connection fails.
    """
    try:
        import psycopg2
    except ImportError:
        logger.error(
            "psycopg2 is not installed. Run: pip install psycopg2-binary"
        )
        sys.exit(1)

    required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"]
    missing = [v for v in required if not os.getenv(v)]
    if missing:
        logger.error(
            "Missing required environment variables: %s\n"
            "Copy ml/.env.example to ml/.env and fill in the Supabase credentials.",
            ", ".join(missing),
        )
        sys.exit(1)

    host     = os.environ["DB_HOST"]
    port     = int(os.environ["DB_PORT"])
    user     = os.environ["DB_USER"]
    password = os.environ["DB_PASSWORD"]
    dbname   = os.environ["DB_NAME"]

    logger.info("Connecting to Supabase PostgreSQL at %s:%d/%s ...", host, port, dbname)
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            dbname=dbname,
            sslmode="require",
            connect_timeout=30,
        )
        logger.info("Connection established.")
        return conn
    except Exception as exc:
        logger.error("Failed to connect to Supabase: %s", exc)
        sys.exit(1)


def _build_upsert_sql(cols: list[str]) -> str:
    """
    Build an INSERT ... ON CONFLICT (name) DO UPDATE SET ... statement.

    The upsert pattern ensures the script is idempotent — running it multiple
    times on the same data will update existing rows rather than fail or duplicate.

    Args:
        cols: Ordered list of column names to insert.

    Returns:
        SQL string with %s placeholders (psycopg2 style).
    """
    col_list    = ", ".join(cols)
    placeholders = ", ".join("%s" for _ in cols)

    # All columns except the conflict target get updated on conflict.
    update_set = ", ".join(
        f"{c} = EXCLUDED.{c}"
        for c in cols
        if c != "name"
    )

    return (
        f"INSERT INTO pokemon_data ({col_list}) "
        f"VALUES ({placeholders}) "
        f"ON CONFLICT (name) DO UPDATE SET {update_set}"
    )


# ---------------------------------------------------------------------------
# Row preparation
# ---------------------------------------------------------------------------

def _df_to_rows(df, cols: list[str]) -> list[tuple]:
    """
    Convert a DataFrame to a list of tuples matching the column order in cols.

    - Applies the _RENAME_MAP column renames.
    - Derives the `generation` column from `pokeapi_id` if not present.
    - Fills missing columns with None.
    - Converts numpy scalar types to native Python so psycopg2 accepts them.

    Args:
        df:   Transformed DataFrame from transform.run_transform().
        cols: Target column names (Supabase schema names, post-rename).

    Returns:
        List of tuples, one per Pokémon row.
    """
    import numpy as np

    df = df.rename(columns=_RENAME_MAP).copy()

    # Derive generation if not already present
    if "generation" not in df.columns and "pokeapi_id" in df.columns:
        df["generation"] = df["pokeapi_id"].apply(_get_generation)

    rows = []
    for _, row in df.iterrows():
        values = []
        for col in cols:
            val = row.get(col, None)
            # Convert numpy scalars → native Python so psycopg2 can serialise them
            if isinstance(val, (np.integer,)):
                val = int(val)
            elif isinstance(val, (np.floating,)):
                val = float(val)
            elif isinstance(val, float) and (val != val):  # NaN check
                val = None
            values.append(val)
        rows.append(tuple(values))
    return rows


def _get_generation(pokeapi_id: int) -> int:
    """Map a national Pokédex ID to its generation number."""
    if pokeapi_id <= 151:   return 1
    elif pokeapi_id <= 251: return 2
    elif pokeapi_id <= 386: return 3
    elif pokeapi_id <= 493: return 4
    elif pokeapi_id <= 649: return 5
    elif pokeapi_id <= 721: return 6
    elif pokeapi_id <= 809: return 7
    elif pokeapi_id <= 905: return 8
    return 9


# ---------------------------------------------------------------------------
# Core seeding logic
# ---------------------------------------------------------------------------

def seed_region(
    region: str,
    conn,
    args: argparse.Namespace,
    cache_dir: str,
    dry_run: bool = False,
) -> dict:
    """
    Run Extract → Transform → Upsert for a single region.

    Each Pokemon that fails to insert is logged and skipped — one bad row
    will not abort the rest of the region.

    Args:
        region:    Region name (must be a key in REGION_RANGES).
        conn:      Open psycopg2 connection (ignored when dry_run=True).
        args:      Parsed CLI args (api_base, assigned_csv).
        cache_dir: Root cache directory for raw JSON (passed to extract).
        dry_run:   If True, skips all DB writes and returns a preview.

    Returns:
        Dict with keys: region, total, inserted, skipped, errors.
    """
    from pipeline.extract import run_extraction
    from pipeline.transform import run_transform
    from utils.name_normalizer import load_assigned_csv

    offset, limit = REGION_RANGES[region]

    print()
    print("=" * 64)
    print(f"  Region: {region.title()}")
    print(f"  Pokédex range: {offset + 1} – {offset + limit}")
    print(f"  Mode: {'DRY RUN (no writes)' if dry_run else 'LIVE'}")
    print("=" * 64)

    # ------------------------------------------------------------------
    # Step 1: Extract
    # ------------------------------------------------------------------
    print(f"\n[1/3] EXTRACT — Fetching {limit} Pokémon from PokéAPI...")
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
        logger.error("Extraction returned 0 Pokémon for %s. Skipping region.", region)
        return {"region": region, "total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    # ------------------------------------------------------------------
    # Step 2: Transform
    # ------------------------------------------------------------------
    print("\n[2/3] TRANSFORM — Cleaning and deriving features...")
    t0 = time.perf_counter()

    assigned_csv = args.assigned_csv
    assigned_names = set()
    try:
        assigned_names = load_assigned_csv(assigned_csv)
        print(f"      Loaded {len(assigned_names)} assigned Pokémon from CSV")
    except Exception as exc:
        logger.warning("Could not load assigned CSV (%s): %s — proceeding without it", assigned_csv, exc)

    df = run_transform(
        pokemon_raw=pokemon_raw,
        type_data=type_data,
        assigned_names=assigned_names,
    )

    elapsed = time.perf_counter() - t0
    print(f"      Done: {len(df)} rows, {len(df.columns)} columns ({elapsed:.1f}s)")

    if df.empty:
        logger.error("Transform produced empty DataFrame for %s. Skipping region.", region)
        return {"region": region, "total": 0, "inserted": 0, "skipped": 0, "errors": 0}

    # ------------------------------------------------------------------
    # Step 3: Upsert (or dry-run preview)
    # ------------------------------------------------------------------
    rows = _df_to_rows(df, _POKEMON_DATA_COLS)
    total = len(rows)

    if dry_run:
        print(f"\n[3/3] DRY RUN — Would upsert {total} rows to pokemon_data (no writes performed)")
        if rows:
            # Show first row as sample
            sample = dict(zip(_POKEMON_DATA_COLS, rows[0]))
            print("\n      Sample row (first Pokémon):")
            for k, v in sample.items():
                print(f"        {k}: {v!r}")
        return {"region": region, "total": total, "inserted": total, "skipped": 0, "errors": 0}

    print(f"\n[3/3] UPSERT — Writing {total} rows to Supabase pokemon_data...")
    t0 = time.perf_counter()

    upsert_sql = _build_upsert_sql(_POKEMON_DATA_COLS)
    cursor = conn.cursor()

    inserted = 0
    error_count = 0

    # Insert in batches of 100 for performance; individual error handling per row
    batch_size = 100
    for batch_start in range(0, total, batch_size):
        batch = rows[batch_start : batch_start + batch_size]
        try:
            cursor.executemany(upsert_sql, batch)
            conn.commit()
            inserted += len(batch)
            print(
                f"      Progress: {min(batch_start + batch_size, total)}/{total} "
                f"({min(batch_start + batch_size, total) * 100 // total}%)"
            )
        except Exception as batch_exc:
            # Batch failed — roll back and retry row-by-row to isolate bad rows
            conn.rollback()
            logger.warning(
                "Batch %d-%d failed (%s) — retrying row-by-row",
                batch_start,
                batch_start + len(batch),
                batch_exc,
            )
            for i, row in enumerate(batch, start=batch_start):
                try:
                    cursor.execute(upsert_sql, row)
                    conn.commit()
                    inserted += 1
                except Exception as row_exc:
                    conn.rollback()
                    # Extract name for logging (first column in _POKEMON_DATA_COLS is "name")
                    name_val = row[0] if row else "?"
                    logger.error(
                        "Failed to insert Pokémon %r (row %d): %s",
                        name_val, i, row_exc,
                    )
                    error_count += 1

    cursor.close()
    elapsed = time.perf_counter() - t0
    skipped = total - inserted - error_count

    print(f"      Done: {inserted} upserted, {skipped} skipped, {error_count} errors ({elapsed:.1f}s)")

    return {
        "region":   region,
        "total":    total,
        "inserted": inserted,
        "skipped":  skipped,
        "errors":   error_count,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed Supabase pokemon_data table from PokéAPI (all 9 generations).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m pipeline.seed_supabase                         # seed all regions
  python -m pipeline.seed_supabase --region kanto          # kanto only
  python -m pipeline.seed_supabase --region paldea --dry-run
  python -m pipeline.seed_supabase --cache-dir ./data/raw  # custom cache path
        """,
    )
    parser.add_argument(
        "--region",
        type=str,
        default="all",
        choices=list(REGION_RANGES.keys()) + ["all"],
        help="Region to seed (default: all). Use 'all' to seed every generation.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Fetch and transform data but do NOT write to Supabase.",
    )
    parser.add_argument(
        "--cache-dir",
        type=str,
        default=os.getenv("CACHE_DIR", "./data/raw"),
        help="Root cache directory for raw API JSON (default: ./data/raw or $CACHE_DIR).",
    )
    parser.add_argument(
        "--api-base",
        type=str,
        default=os.getenv("API_BASE_URL", "https://pokeapi.co/api/v2"),
        help="PokéAPI base URL (default: https://pokeapi.co/api/v2).",
    )
    parser.add_argument(
        "--assigned-csv",
        type=str,
        default=os.getenv("ASSIGNED_CSV_PATH", "./data/csv/assigned_pokemon.csv"),
        help="Path to assigned_pokemon.csv (default: ./data/csv/assigned_pokemon.csv).",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    args = _parse_args()

    # Resolve all paths relative to the ml/ directory
    cache_dir    = str((_ML_DIR / args.cache_dir).resolve())
    args.assigned_csv = str((_ML_DIR / args.assigned_csv).resolve())

    regions = list(REGION_RANGES.keys()) if args.region == "all" else [args.region]

    print()
    print("=" * 64)
    print("  Supabase Pokémon Seeder")
    print(f"  Regions to process: {', '.join(r.title() for r in regions)}")
    print(f"  Mode: {'DRY RUN' if args.dry_run else 'LIVE — writing to Supabase'}")
    print(f"  Cache: {cache_dir}")
    print("=" * 64)

    # Open DB connection (skipped in dry-run mode)
    conn = None
    if not args.dry_run:
        conn = _get_connection()

    overall_start = time.perf_counter()
    summary: list[dict] = []

    for region in regions:
        result = seed_region(
            region=region,
            conn=conn,
            args=args,
            cache_dir=cache_dir,
            dry_run=args.dry_run,
        )
        summary.append(result)

    if conn:
        conn.close()
        logger.info("Database connection closed.")

    # ------------------------------------------------------------------
    # Final summary
    # ------------------------------------------------------------------
    total_elapsed = time.perf_counter() - overall_start
    total_pokemon  = sum(r["total"]    for r in summary)
    total_inserted = sum(r["inserted"] for r in summary)
    total_errors   = sum(r["errors"]   for r in summary)

    print()
    print("=" * 64)
    print("  SEEDING COMPLETE")
    print(f"  Total time:     {total_elapsed:.1f}s")
    print(f"  Regions run:    {len(summary)}")
    print(f"  Pokemon total:  {total_pokemon}")
    print(f"  Upserted:       {total_inserted}")
    print(f"  Errors:         {total_errors}")
    print()
    print("  Per-region breakdown:")
    print(f"  {'Region':<10} {'Total':>7} {'Upserted':>10} {'Errors':>8}")
    print(f"  {'-'*10} {'-'*7} {'-'*10} {'-'*8}")
    for r in summary:
        print(
            f"  {r['region'].title():<10} {r['total']:>7} {r['inserted']:>10} {r['errors']:>8}"
        )
    print("=" * 64)

    if total_errors > 0:
        print(f"\n  {total_errors} rows failed to insert. Check logs above for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
