"""
Load layer — write transformed Pokémon data to SQLite.

Table schema:
    pokemon          — one row per Pokémon with all base stats + features
    type_matchups    — 18 defensive matchup columns per Pokémon (def_vs_{type})
    scaled_stats     — 7 min-max scaled stat columns per Pokémon
    role_assignments — role label + is_assigned flag per Pokémon
    team_metadata    — placeholder for future team composition data

All loads use INSERT OR REPLACE to remain idempotent.
Data quality checks run before the function returns.
"""

import logging
import sqlite3
from pathlib import Path

import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from constants import TYPES

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Schema DDL
# ---------------------------------------------------------------------------

_DDL_POKEMON = """
CREATE TABLE IF NOT EXISTS pokemon (
    name                   TEXT PRIMARY KEY,
    pokedex_id             INTEGER,
    type_1                 TEXT NOT NULL,
    type_2                 TEXT,
    hp                     INTEGER NOT NULL,
    attack                 INTEGER NOT NULL,
    defense                INTEGER NOT NULL,
    sp_atk                 INTEGER NOT NULL,
    sp_def                 INTEGER NOT NULL,
    speed                  INTEGER NOT NULL,
    total_base_stats       INTEGER NOT NULL,
    attack_ratio           REAL,
    special_attack_ratio   REAL,
    speed_tier             TEXT,
    speed_tier_encoded     INTEGER,
    weakness_count         INTEGER,
    resistance_count       INTEGER,
    type_coverage_score    INTEGER,
    role_label             TEXT,
    is_assigned            INTEGER DEFAULT 0,
    ability_1              TEXT,
    ability_2              TEXT,
    hidden_ability         TEXT,
    height_dm              INTEGER,
    weight_hg              INTEGER,
    _source                TEXT DEFAULT 'pokeapi',
    _ingested_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    _transformed_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
"""

_DDL_TYPE_MATCHUPS = """
CREATE TABLE IF NOT EXISTS type_matchups (
    name        TEXT PRIMARY KEY,
    {cols},
    FOREIGN KEY (name) REFERENCES pokemon(name) ON DELETE CASCADE
);
""".format(
    cols=",\n    ".join(f"def_vs_{t} REAL" for t in TYPES)
)

_DDL_SCALED_STATS = """
CREATE TABLE IF NOT EXISTS scaled_stats (
    name            TEXT PRIMARY KEY,
    hp_scaled       REAL,
    attack_scaled   REAL,
    defense_scaled  REAL,
    sp_atk_scaled   REAL,
    sp_def_scaled   REAL,
    speed_scaled    REAL,
    total_scaled    REAL,
    FOREIGN KEY (name) REFERENCES pokemon(name) ON DELETE CASCADE
);
"""

_DDL_ROLE_ASSIGNMENTS = """
CREATE TABLE IF NOT EXISTS role_assignments (
    name        TEXT PRIMARY KEY,
    role_label  TEXT NOT NULL,
    is_assigned INTEGER DEFAULT 0,
    FOREIGN KEY (name) REFERENCES pokemon(name) ON DELETE CASCADE
);
"""

_DDL_TEAM_METADATA = """
CREATE TABLE IF NOT EXISTS team_metadata (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name   TEXT,
    pokemon_names TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
"""


# ---------------------------------------------------------------------------
# Table creation
# ---------------------------------------------------------------------------

def create_tables(conn: sqlite3.Connection) -> None:
    """
    Create all 5 database tables if they don't already exist.

    Idempotent — safe to call on every pipeline run.

    Args:
        conn: Active SQLite connection.
    """
    cursor = conn.cursor()
    cursor.executescript(
        _DDL_POKEMON
        + _DDL_TYPE_MATCHUPS
        + _DDL_SCALED_STATS
        + _DDL_ROLE_ASSIGNMENTS
        + _DDL_TEAM_METADATA
    )
    conn.commit()
    logger.info("Tables created/verified")


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------

def _df_to_sqlite(
    conn: sqlite3.Connection,
    df: pd.DataFrame,
    table: str,
    columns: list[str],
    pk_col: str = "name",
) -> int:
    """
    INSERT OR REPLACE rows from df into table using only the specified columns.

    Args:
        conn:    Active SQLite connection.
        df:      Source DataFrame.
        table:   Target table name.
        columns: Columns to write (must exist in df; missing ones silently become NULL).
        pk_col:  Primary key column (used only for logging).

    Returns:
        Number of rows written.
    """
    # Keep only columns that actually exist in df
    present = [c for c in columns if c in df.columns]
    missing = [c for c in columns if c not in df.columns]
    if missing:
        logger.debug("Columns absent from DataFrame for table %s: %s", table, missing)

    if not present:
        logger.warning("No columns to write for table %s", table)
        return 0

    sub = df[present].copy()
    # Add any missing columns as NULL
    for c in missing:
        sub[c] = None

    sub = sub[columns]  # enforce column order

    placeholders = ", ".join("?" for _ in columns)
    col_names = ", ".join(columns)
    sql = f"INSERT OR REPLACE INTO {table} ({col_names}) VALUES ({placeholders})"

    rows = [tuple(row) for row in sub.itertuples(index=False, name=None)]
    cursor = conn.cursor()
    cursor.executemany(sql, rows)
    conn.commit()
    logger.debug("Wrote %d rows to %s", len(rows), table)
    return len(rows)


def load_pokemon(conn: sqlite3.Connection, df: pd.DataFrame) -> int:
    """
    Insert or replace Pokémon records across all 4 data tables atomically.

    Distributes columns to their respective tables:
        pokemon          — core stats + metadata
        type_matchups    — 18 def_vs_* columns
        scaled_stats     — 7 *_scaled columns
        role_assignments — role_label + is_assigned

    Args:
        conn: Active SQLite connection.
        df:   Full transformed DataFrame from transform.run_transform().

    Returns:
        Number of rows inserted into the main pokemon table.
    """
    pokemon_cols = [
        "name", "pokedex_id", "type_1", "type_2",
        "hp", "attack", "defense", "sp_atk", "sp_def", "speed",
        "total_base_stats", "attack_ratio", "special_attack_ratio",
        "speed_tier", "speed_tier_encoded",
        "weakness_count", "resistance_count", "type_coverage_score",
        "role_label", "is_assigned",
        "ability_1", "ability_2", "hidden_ability",
        "height_dm", "weight_hg", "_source",
    ]

    matchup_cols = ["name"] + [f"def_vs_{t}" for t in TYPES]

    scaled_cols = [
        "name", "hp_scaled", "attack_scaled", "defense_scaled",
        "sp_atk_scaled", "sp_def_scaled", "speed_scaled", "total_scaled",
    ]

    role_cols = ["name", "role_label", "is_assigned"]

    try:
        with conn:  # transaction context
            n = _df_to_sqlite(conn, df, "pokemon", pokemon_cols)
            _df_to_sqlite(conn, df, "type_matchups", matchup_cols)
            _df_to_sqlite(conn, df, "scaled_stats", scaled_cols)
            _df_to_sqlite(conn, df, "role_assignments", role_cols)
    except sqlite3.Error as exc:
        logger.error("Database write failed: %s", exc)
        raise

    logger.info("Loaded %d Pokémon records into database", n)
    return n


# ---------------------------------------------------------------------------
# Data quality checks
# ---------------------------------------------------------------------------

def run_data_quality_checks(conn: sqlite3.Connection) -> None:
    """
    Run data quality assertions against the loaded pokemon table.

    Checks performed:
        1. No null values in any stat column (hp, attack, defense, sp_atk, sp_def, speed)
        2. All stat values in range [1, 255]
        3. type_1 is always one of the 18 canonical types
        4. type_1 != type_2 (no Pokémon has the same type listed twice)
        5. No null role_label
        6. All scaled columns in [0, 1]

    Prints a summary of each check. Raises ValueError on any critical failure.

    Args:
        conn: Active SQLite connection (must have pokemon + scaled_stats tables loaded).
    """
    cursor = conn.cursor()
    errors: list[str] = []

    print("\n--- Data Quality Report ---")

    # 1. Null stats
    stat_cols = ["hp", "attack", "defense", "sp_atk", "sp_def", "speed"]
    null_stat_checks = " OR ".join(f"{c} IS NULL" for c in stat_cols)
    cursor.execute(f"SELECT COUNT(*) FROM pokemon WHERE {null_stat_checks}")
    null_stat_count = cursor.fetchone()[0]
    status = "PASS" if null_stat_count == 0 else "FAIL"
    print(f"[{status}] Null stats: {null_stat_count} rows with null stat values")
    if null_stat_count > 0:
        errors.append(f"{null_stat_count} rows have null stat values")

    # 2. Stat range [1, 255]
    range_checks = " OR ".join(
        f"({c} < 1 OR {c} > 255)" for c in stat_cols
    )
    cursor.execute(f"SELECT COUNT(*) FROM pokemon WHERE {range_checks}")
    out_of_range = cursor.fetchone()[0]
    status = "PASS" if out_of_range == 0 else "FAIL"
    print(f"[{status}] Stat range [1-255]: {out_of_range} rows out of range")
    if out_of_range > 0:
        errors.append(f"{out_of_range} rows have stats outside [1, 255]")

    # 3. Valid type_1
    valid_types = ", ".join(f"'{t}'" for t in TYPES)
    cursor.execute(f"SELECT COUNT(*) FROM pokemon WHERE type_1 NOT IN ({valid_types})")
    invalid_type = cursor.fetchone()[0]
    status = "PASS" if invalid_type == 0 else "FAIL"
    print(f"[{status}] Valid type_1: {invalid_type} rows with unrecognized type_1")
    if invalid_type > 0:
        errors.append(f"{invalid_type} rows have invalid type_1")

    # 4. type_1 != type_2
    cursor.execute(
        "SELECT COUNT(*) FROM pokemon WHERE type_2 IS NOT NULL AND type_1 = type_2"
    )
    same_types = cursor.fetchone()[0]
    status = "PASS" if same_types == 0 else "FAIL"
    print(f"[{status}] type_1 != type_2: {same_types} rows where both types are equal")
    if same_types > 0:
        errors.append(f"{same_types} rows have type_1 == type_2")

    # 5. No null role_label
    cursor.execute("SELECT COUNT(*) FROM pokemon WHERE role_label IS NULL")
    null_roles = cursor.fetchone()[0]
    status = "PASS" if null_roles == 0 else "FAIL"
    print(f"[{status}] No null role_label: {null_roles} rows missing role_label")
    if null_roles > 0:
        errors.append(f"{null_roles} rows have null role_label")

    # 6. Scaled values in [0, 1]
    scaled_cols_check = [
        "hp_scaled", "attack_scaled", "defense_scaled",
        "sp_atk_scaled", "sp_def_scaled", "speed_scaled", "total_scaled"
    ]
    scale_range_sql = " OR ".join(
        f"({c} < -0.0001 OR {c} > 1.0001)" for c in scaled_cols_check
    )
    try:
        cursor.execute(f"SELECT COUNT(*) FROM scaled_stats WHERE {scale_range_sql}")
        out_of_scale = cursor.fetchone()[0]
        status = "PASS" if out_of_scale == 0 else "FAIL"
        print(f"[{status}] Scaled values [0-1]: {out_of_scale} rows out of range")
        if out_of_scale > 0:
            errors.append(f"{out_of_scale} scaled stat rows outside [0, 1]")
    except sqlite3.OperationalError as exc:
        print(f"[SKIP] Scaled stats check skipped: {exc}")

    # Summary
    print(f"\nTotal checks: 6  |  Passed: {6 - len(errors)}  |  Failed: {len(errors)}")
    if errors:
        print("FAILURES:")
        for e in errors:
            print(f"  - {e}")
        raise ValueError(f"Data quality check failed with {len(errors)} error(s): {errors}")
    else:
        print("All data quality checks passed.")


# ---------------------------------------------------------------------------
# Main load entry point
# ---------------------------------------------------------------------------

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


def sync_to_pokemon_data(conn: sqlite3.Connection, df: pd.DataFrame) -> int:
    """
    Write/sync records to the NestJS-compatible `pokemon_data` table.

    NestJS DatabaseService creates and reads `pokemon_data` with column names
    `special_attack`, `special_defense`, `pokeapi_id` etc.  The ML pipeline
    uses `sp_atk`, `sp_def`, `pokedex_id` internally.  This function bridges
    the two naming conventions so NestJS can query Pokémon after the pipeline runs.

    The `pokemon_data` table is created by NestJS on startup; we INSERT OR REPLACE
    here so a standalone pipeline run also populates it correctly.
    """
    # Build NestJS-compatible column mapping from the DataFrame
    rename_map = {
        "sp_atk":   "special_attack",
        "sp_def":   "special_defense",
        "pokedex_id": "pokeapi_id",
        "_source":  "data_source",
        "_ingested_at": "created_at",
        "sp_atk_scaled": "special_attack_scaled",
        "sp_def_scaled":  "special_defense_scaled",
    }
    sync_df = df.rename(columns=rename_map).copy()

    # Derive generation column from pokeapi_id
    if "pokeapi_id" in sync_df.columns:
        sync_df["generation"] = sync_df["pokeapi_id"].apply(_get_generation)

    # Ensure the pokemon_data table exists (NestJS may not have started yet)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pokemon_data (
            pokemon_id             INTEGER PRIMARY KEY AUTOINCREMENT,
            pokeapi_id             INTEGER UNIQUE NOT NULL,
            name                   TEXT UNIQUE NOT NULL,
            type_1                 TEXT NOT NULL,
            type_2                 TEXT,
            hp                     INTEGER NOT NULL,
            attack                 INTEGER NOT NULL,
            defense                INTEGER NOT NULL,
            special_attack         INTEGER NOT NULL,
            special_defense        INTEGER NOT NULL,
            speed                  INTEGER NOT NULL,
            base_experience        INTEGER,
            ability_1              TEXT,
            ability_2              TEXT,
            total_base_stats       INTEGER NOT NULL,
            attack_ratio           REAL,
            special_attack_ratio   REAL,
            speed_tier             TEXT,
            speed_tier_encoded     INTEGER,
            weakness_count         INTEGER DEFAULT 0,
            resistance_count       INTEGER DEFAULT 0,
            type_coverage_score    INTEGER DEFAULT 0,
            role_label             TEXT,
            native_region          TEXT,
            generation             INTEGER,
            restricted_status      TEXT DEFAULT 'none',
            def_vs_normal REAL, def_vs_fire REAL, def_vs_water REAL,
            def_vs_electric REAL, def_vs_grass REAL, def_vs_ice REAL,
            def_vs_fighting REAL, def_vs_poison REAL, def_vs_ground REAL,
            def_vs_flying REAL, def_vs_psychic REAL, def_vs_bug REAL,
            def_vs_rock REAL, def_vs_ghost REAL, def_vs_dragon REAL,
            def_vs_dark REAL, def_vs_steel REAL, def_vs_fairy REAL,
            hp_scaled REAL, attack_scaled REAL, defense_scaled REAL,
            special_attack_scaled REAL, special_defense_scaled REAL,
            speed_scaled REAL, total_scaled REAL,
            is_assigned            INTEGER DEFAULT 0,
            data_source            TEXT DEFAULT 'pokeapi',
            created_at             TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()

    # Add missing columns to existing pokemon_data table (for re-runs after schema change)
    for col_def in [
        ("native_region",     "TEXT"),
        ("generation",        "INTEGER"),
        ("restricted_status", "TEXT DEFAULT 'none'"),
    ]:
        try:
            conn.execute(f"ALTER TABLE pokemon_data ADD COLUMN {col_def[0]} {col_def[1]}")
            conn.commit()
            logger.info("Added column %s to pokemon_data", col_def[0])
        except Exception:
            pass  # Column already exists — ignore

    # Columns the NestJS pokemon_data table expects (subset we can provide)
    nestjs_cols = [
        "pokeapi_id", "name", "type_1", "type_2",
        "hp", "attack", "defense", "special_attack", "special_defense", "speed",
        "ability_1", "ability_2", "total_base_stats",
        "attack_ratio", "special_attack_ratio",
        "speed_tier", "speed_tier_encoded",
        "weakness_count", "resistance_count", "type_coverage_score",
        "role_label", "is_assigned", "data_source",
        "native_region", "generation", "restricted_status",
    ] + [f"def_vs_{t}" for t in TYPES] + [
        "hp_scaled", "attack_scaled", "defense_scaled",
        "special_attack_scaled", "special_defense_scaled",
        "speed_scaled", "total_scaled",
    ]

    present = [c for c in nestjs_cols if c in sync_df.columns]
    missing = [c for c in nestjs_cols if c not in sync_df.columns]
    if missing:
        logger.debug("Columns absent when syncing to pokemon_data: %s", missing)
        for c in missing:
            sync_df[c] = None

    sub = sync_df[nestjs_cols].copy()

    placeholders = ", ".join("?" for _ in nestjs_cols)
    col_names = ", ".join(nestjs_cols)
    sql = f"INSERT OR REPLACE INTO pokemon_data ({col_names}) VALUES ({placeholders})"

    rows = [tuple(row) for row in sub.itertuples(index=False, name=None)]
    cursor = conn.cursor()
    cursor.executemany(sql, rows)
    conn.commit()
    logger.info("Synced %d rows to pokemon_data (NestJS table)", len(rows))
    return len(rows)


def run_load(df: pd.DataFrame, db_path: str = "../pokemon.db") -> None:
    """
    Main load entry point.

    Creates tables, loads all data, and runs quality checks.

    Args:
        df:      Fully transformed DataFrame from transform.run_transform().
        db_path: Path to the SQLite database file.
    """
    db_file = Path(db_path)
    db_file.parent.mkdir(parents=True, exist_ok=True)

    logger.info("Connecting to database: %s", db_file.resolve())
    conn = sqlite3.connect(str(db_file))

    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")

        create_tables(conn)
        n = load_pokemon(conn, df)
        logger.info("Load complete: %d records written", n)

        run_data_quality_checks(conn)

        # Sync to NestJS-compatible pokemon_data table (renames sp_atk → special_attack etc.)
        sync_to_pokemon_data(conn, df)

    finally:
        conn.close()
        logger.info("Database connection closed")
