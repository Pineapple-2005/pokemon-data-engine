"""
Transform layer — parse raw PokéAPI JSON into a clean, feature-rich DataFrame.

Key responsibilities:
    - Parse raw API dicts into flat feature dicts
    - Compute defensive matchup columns (def_vs_{type} x 18)
    - Assign heuristic role labels
    - Derive composite features (ratios, tier encodings, coverage scores)
    - Apply min-max scaling to stat columns
    - Filter out alternate forms (mega, alolan, etc.)
    - Flag assigned Pokémon
"""

import logging
from pathlib import Path
import sys

import pandas as pd
from sklearn.preprocessing import MinMaxScaler

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from constants import TYPES, SPEED_TIERS
from utils.type_chart import get_all_defensive_matchups, get_offensive_coverage

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Region and restriction helpers
# ---------------------------------------------------------------------------

def get_native_region(pokeapi_id: int) -> str:
    """Map a national Pokédex ID to its native region name."""
    if 1 <= pokeapi_id <= 151:     return "Kanto"
    elif 152 <= pokeapi_id <= 251: return "Johto"
    elif 252 <= pokeapi_id <= 386: return "Hoenn"
    elif 387 <= pokeapi_id <= 493: return "Sinnoh"
    elif 494 <= pokeapi_id <= 649: return "Unova"
    elif 650 <= pokeapi_id <= 721: return "Kalos"
    elif 722 <= pokeapi_id <= 809: return "Alola"
    elif 810 <= pokeapi_id <= 905: return "Galar"
    elif 906 <= pokeapi_id <= 1025: return "Paldea"
    return "Unknown"


_LEGENDARY_IDS = {
    # Kanto
    144, 145, 146, 150,
    # Johto
    243, 244, 245, 249, 250,
    # Hoenn
    377, 378, 379, 380, 381, 382, 383, 384,
    # Sinnoh
    480, 481, 482, 483, 484, 485, 486, 487, 488,
    # Unova
    638, 639, 640, 641, 642, 643, 644, 645, 646,
    # Kalos
    716, 717, 718,
    # Alola
    772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 800,
    # Galar
    888, 889, 894, 895, 896, 897, 898,
}

_MYTHICAL_IDS = {
    # Kanto
    151,
    # Johto
    251,
    # Hoenn
    385, 386,
    # Sinnoh
    489, 490, 491, 492, 493,
    # Unova
    494, 647, 648, 649,
    # Kalos
    719, 720, 721,
    # Alola
    801, 802, 803, 804, 805, 806, 807, 808, 809,
}


def get_restricted_status(pokeapi_id: int) -> str:
    """Return 'legendary', 'mythical', or 'none' for a Pokémon ID."""
    if pokeapi_id in _LEGENDARY_IDS:
        return "legendary"
    if pokeapi_id in _MYTHICAL_IDS:
        return "mythical"
    return "none"


# ---------------------------------------------------------------------------
# Alternate-form suffixes to exclude
# ---------------------------------------------------------------------------
_EXCLUDED_SUFFIXES = (
    "-mega", "-alolan", "-galarian", "-hisuian", "-paldean", "-gmax", "-totem"
)

# Stat columns that will receive _scaled counterparts
_SCALE_COLS = ["hp", "attack", "defense", "sp_atk", "sp_def", "speed", "total_base_stats"]


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _safe_stat(stats_list: list[dict], stat_name: str) -> int:
    """
    Extract a stat value by name from PokéAPI's stats array.

    PokéAPI format:
        [{"base_stat": 45, "effort": 0, "stat": {"name": "hp", "url": "..."}}, ...]

    We MUST look up by stat.name, NOT by array index, because order can vary.

    Args:
        stats_list: The "stats" array from the Pokémon API dict.
        stat_name:  PokéAPI stat name (e.g. "hp", "attack", "special-attack").

    Returns:
        Integer stat value, or 0 if not found.
    """
    for entry in stats_list:
        if entry.get("stat", {}).get("name") == stat_name:
            return int(entry.get("base_stat", 0))
    logger.debug("Stat %r not found in stats list", stat_name)
    return 0


def parse_pokemon_json(raw: dict) -> dict | None:
    """
    Parse a raw PokéAPI Pokémon dict into a flat feature dict.

    Extracts all six base stats (by name), types, abilities, height/weight,
    and attaches _source lineage metadata.

    Args:
        raw: Raw dict returned by the PokéAPI /pokemon/{name} endpoint.

    Returns:
        Flat dict with all parsed fields, or None if parsing fails critically.
    """
    try:
        name = raw.get("name", "").lower()
        poke_id = raw.get("id", 0)

        # Types
        types_data = raw.get("types", [])
        # Sort by slot to ensure type_1 is always slot 1
        types_data_sorted = sorted(types_data, key=lambda x: x.get("slot", 99))
        type_1 = types_data_sorted[0]["type"]["name"].lower() if len(types_data_sorted) >= 1 else None
        type_2 = types_data_sorted[1]["type"]["name"].lower() if len(types_data_sorted) >= 2 else None

        # Stats — always look up by name
        stats_list = raw.get("stats", [])
        hp          = _safe_stat(stats_list, "hp")
        attack      = _safe_stat(stats_list, "attack")
        defense     = _safe_stat(stats_list, "defense")
        sp_atk      = _safe_stat(stats_list, "special-attack")
        sp_def      = _safe_stat(stats_list, "special-defense")
        speed       = _safe_stat(stats_list, "speed")

        # Abilities
        abilities_data = raw.get("abilities", [])
        abilities = [
            a["ability"]["name"].lower()
            for a in sorted(abilities_data, key=lambda x: x.get("slot", 99))
        ]
        ability_1 = abilities[0] if len(abilities) >= 1 else None
        ability_2 = abilities[1] if len(abilities) >= 2 else None
        hidden_ability = next(
            (a["ability"]["name"].lower() for a in abilities_data if a.get("is_hidden")),
            None
        )

        # Physical attributes
        height_dm = raw.get("height", 0)   # in decimetres
        weight_hg = raw.get("weight", 0)   # in hectograms

        return {
            "name":              name,
            "pokedex_id":        poke_id,
            "type_1":            type_1,
            "type_2":            type_2,
            "hp":                hp,
            "attack":            attack,
            "defense":           defense,
            "sp_atk":            sp_atk,
            "sp_def":            sp_def,
            "speed":             speed,
            "ability_1":         ability_1,
            "ability_2":         ability_2,
            "hidden_ability":    hidden_ability,
            "height_dm":         height_dm,
            "weight_hg":         weight_hg,
            "native_region":     get_native_region(poke_id),
            "restricted_status": get_restricted_status(poke_id),
            "_source":           "pokeapi",
        }

    except (KeyError, IndexError, TypeError) as exc:
        logger.error("Failed to parse Pokémon JSON for %r: %s", raw.get("name", "?"), exc)
        return None


# ---------------------------------------------------------------------------
# Computed feature functions
# ---------------------------------------------------------------------------

def compute_defensive_matchups(type_1: str, type_2: str | None, type_chart: dict) -> dict:
    """
    Compute defensive multipliers against all 18 attacking types.

    Uses the canonical TYPE_CHART (not the API type data) for correctness.
    Dual-type contributions are multiplied together.

    Args:
        type_1:     Primary defending type (lowercase).
        type_2:     Secondary defending type or None.
        type_chart: The 18x18 TYPE_CHART dict from constants.py.
                    (Passed as parameter to keep this function testable in isolation.)

    Returns:
        Dict with keys "def_vs_{type}" for each of the 18 types,
        values are float multipliers (0.0 / 0.25 / 0.5 / 1.0 / 2.0 / 4.0).
    """
    matchups = get_all_defensive_matchups(type_1, type_2 if type_2 else None)
    return {f"def_vs_{atk_type}": mult for atk_type, mult in matchups.items()}


def assign_role_label(stats: dict) -> str:
    """
    Assign a heuristic competitive role based on base stats.

    Priority order (first match wins):
        1. sweeper:  (attack > 100 OR sp_atk > 100) AND speed > 90
        2. tank:     hp > 90 AND defense > 90
        3. wall:     sp_def > 90 OR hp > 100
        4. support:  total < 400 AND max(attack, sp_atk) < 80
        5. balanced: everything else

    Args:
        stats: Dict with keys: hp, attack, defense, sp_atk, sp_def, speed, total_base_stats.

    Returns:
        Role string: one of 'sweeper', 'tank', 'wall', 'support', 'balanced'.
    """
    hp      = stats.get("hp", 0)
    atk     = stats.get("attack", 0)
    defense = stats.get("defense", 0)
    sp_atk  = stats.get("sp_atk", 0)
    sp_def  = stats.get("sp_def", 0)
    speed   = stats.get("speed", 0)
    total   = stats.get("total_base_stats", 0)

    if (atk > 100 or sp_atk > 100) and speed > 90:
        return "sweeper"
    if hp > 90 and defense > 90:
        return "tank"
    if sp_def > 90 or hp > 100:
        return "wall"
    if total < 400 and max(atk, sp_atk) < 80:
        return "support"
    return "balanced"


def _assign_speed_tier(speed: int) -> tuple[str, int]:
    """
    Map a speed stat value to a named tier and its integer encoding.

    Tier boundaries from SPEED_TIERS in constants.py:
        slow:   0-59    → 0
        medium: 60-100  → 1
        fast:   101+    → 2

    Returns:
        (tier_name, tier_encoded)
    """
    for tier_name, (low, high) in SPEED_TIERS.items():
        if low <= speed <= high:
            if tier_name == "slow":
                return "slow", 0
            elif tier_name == "medium":
                return "medium", 1
            else:
                return "fast", 2
    # Fallback for edge cases
    return "fast", 2


def apply_minmax_scaling(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fit a MinMaxScaler on the full DataFrame and append _scaled columns.

    IMPORTANT: The scaler is ALWAYS fit on the full input DataFrame.
    Never call this on a subset — doing so would produce misleading relative scales.

    Scales: hp, attack, defense, sp_atk, sp_def, speed, total_base_stats
    Output columns: hp_scaled, attack_scaled, defense_scaled, sp_atk_scaled,
                    sp_def_scaled, speed_scaled, total_scaled

    Args:
        df: Full cleaned DataFrame before scaling.

    Returns:
        DataFrame with 7 new _scaled columns appended (values in [0, 1]).
    """
    df = df.copy()
    present_cols = [c for c in _SCALE_COLS if c in df.columns]

    if not present_cols:
        logger.warning("No scalable columns found in DataFrame")
        return df

    scaler = MinMaxScaler()
    scaled_values = scaler.fit_transform(df[present_cols])

    for i, col in enumerate(present_cols):
        # total_base_stats → total_scaled (shorter alias)
        out_name = "total_scaled" if col == "total_base_stats" else f"{col}_scaled"
        df[out_name] = scaled_values[:, i]

    logger.debug("Applied MinMax scaling to %d columns", len(present_cols))
    return df


def compute_team_features(team: list[dict]) -> dict:
    """
    Compute team-level aggregate features for Engine 3 team analysis.

    Args:
        team: List of flat Pokémon feature dicts (post-transform).

    Returns:
        Dict with aggregate stats:
            avg_speed, avg_total, sum_total, unique_types (count),
            avg_hp, avg_attack, avg_defense, avg_sp_atk, avg_sp_def,
            avg_weakness_count, avg_resistance_count
    """
    if not team:
        return {}

    def avg(key):
        vals = [p.get(key, 0) for p in team if p.get(key) is not None]
        return sum(vals) / len(vals) if vals else 0.0

    types_seen: set[str] = set()
    for p in team:
        for t in [p.get("type_1"), p.get("type_2")]:
            if t:
                types_seen.add(t)

    return {
        "avg_speed":           avg("speed"),
        "avg_total":           avg("total_base_stats"),
        "sum_total":           sum(p.get("total_base_stats", 0) for p in team),
        "unique_types":        len(types_seen),
        "avg_hp":              avg("hp"),
        "avg_attack":          avg("attack"),
        "avg_defense":         avg("defense"),
        "avg_sp_atk":          avg("sp_atk"),
        "avg_sp_def":          avg("sp_def"),
        "avg_weakness_count":  avg("weakness_count"),
        "avg_resistance_count": avg("resistance_count"),
    }


# ---------------------------------------------------------------------------
# Main transform pipeline
# ---------------------------------------------------------------------------

def run_transform(
    pokemon_raw: list[dict],
    type_data: dict,
    assigned_names: set[str],
) -> pd.DataFrame:
    """
    Full transform pipeline from raw API dicts to a clean, feature-rich DataFrame.

    Steps:
        1. Parse each raw Pokémon dict
        2. Filter out alternate forms (-mega, -alolan, etc.)
        3. Derive composite features
        4. Compute defensive matchup columns
        5. Assign role labels
        6. Flag assigned Pokémon
        7. Apply min-max scaling

    Args:
        pokemon_raw:    List of raw dicts from extract.run_extraction().
        type_data:      Dict of type_name -> type API dict (currently unused in transform;
                        TYPE_CHART from constants is the source of truth for matchups).
        assigned_names: Set of normalized Pokémon names marked as 'assigned'.

    Returns:
        Cleaned DataFrame with all required columns.
    """
    from constants import TYPE_CHART  # import here to avoid circular at module level

    records: list[dict] = []
    skipped_forms = 0
    parse_failures = 0

    for raw in pokemon_raw:
        parsed = parse_pokemon_json(raw)
        if parsed is None:
            parse_failures += 1
            continue

        name = parsed["name"]

        # Filter alternate forms
        if any(name.endswith(suffix) for suffix in _EXCLUDED_SUFFIXES):
            logger.debug("Filtered alternate form: %s", name)
            skipped_forms += 1
            continue

        type_1 = parsed["type_1"]
        type_2 = parsed.get("type_2")

        if not type_1:
            logger.warning("Pokémon %s has no type_1 — skipping", name)
            continue

        # Derived stat features
        hp      = parsed["hp"]
        attack  = parsed["attack"]
        defense = parsed["defense"]
        sp_atk  = parsed["sp_atk"]
        sp_def  = parsed["sp_def"]
        speed   = parsed["speed"]
        total   = hp + attack + defense + sp_atk + sp_def + speed

        parsed["total_base_stats"] = total
        parsed["attack_ratio"]         = round(attack / total, 4) if total > 0 else 0.0
        parsed["special_attack_ratio"] = round(sp_atk / total, 4) if total > 0 else 0.0

        # Speed tier
        tier_name, tier_encoded = _assign_speed_tier(speed)
        parsed["speed_tier"]         = tier_name
        parsed["speed_tier_encoded"] = tier_encoded

        # Defensive matchups
        matchup_cols = compute_defensive_matchups(type_1, type_2, TYPE_CHART)
        parsed.update(matchup_cols)

        # Weakness / resistance counts (from matchup data)
        parsed["weakness_count"]  = sum(1 for v in matchup_cols.values() if v >= 2.0)
        parsed["resistance_count"] = sum(1 for v in matchup_cols.values() if v <= 0.5)

        # Type coverage score — how many types does type_1 hit super-effectively
        coverage_types = get_offensive_coverage(type_1)
        parsed["type_coverage_score"] = len(coverage_types)

        # Role label
        stats_for_role = {
            "hp": hp, "attack": attack, "defense": defense,
            "sp_atk": sp_atk, "sp_def": sp_def, "speed": speed,
            "total_base_stats": total,
        }
        parsed["role_label"] = assign_role_label(stats_for_role)

        # Assigned flag
        parsed["is_assigned"] = 1 if name in assigned_names else 0

        records.append(parsed)

    logger.info(
        "Transform: %d records processed, %d alternate forms filtered, %d parse failures",
        len(records), skipped_forms, parse_failures
    )

    if not records:
        logger.error("Transform produced 0 records — returning empty DataFrame")
        return pd.DataFrame()

    df = pd.DataFrame(records)

    # Apply scaling on the full dataset
    df = apply_minmax_scaling(df)

    # Sort by Pokédex ID for deterministic output
    if "pokedex_id" in df.columns:
        df = df.sort_values("pokedex_id").reset_index(drop=True)

    logger.info("Transform complete: %d rows, %d columns", len(df), len(df.columns))
    return df
