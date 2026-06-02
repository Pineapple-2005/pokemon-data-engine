"""
Type chart utilities — defensive matchup computation, offensive coverage, and type advantage scoring.

All logic reads from TYPE_CHART in constants.py (no JSON file dependency).
TYPE_CHART[attacker][defender] = multiplier  (0.0 / 0.5 / 1.0 / 2.0)
"""

import logging
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from constants import TYPE_CHART, TYPES

logger = logging.getLogger(__name__)


def get_defensive_multiplier(type_1: str, type_2: str | None, attacking_type: str) -> float:
    """
    Return the combined defensive multiplier when a Pokémon of type_1 (and optionally type_2)
    is attacked by attacking_type.

    For dual-type Pokémon both resistances/immunities/weaknesses stack multiplicatively:
        multiplier = chart[attacking_type][type_1] * chart[attacking_type][type_2]

    Args:
        type_1:         Primary type of the defending Pokémon (lowercase).
        type_2:         Secondary type, or None for single-type Pokémon.
        attacking_type: The type of the incoming move (lowercase).

    Returns:
        float — 0.0 (immune), 0.25, 0.5, 1.0, 2.0, or 4.0.
    """
    if attacking_type not in TYPE_CHART:
        logger.warning("Unknown attacking type: %r", attacking_type)
        return 1.0
    if type_1 not in TYPE_CHART[attacking_type]:
        logger.warning("Unknown defending type_1: %r", type_1)
        return 1.0

    mult = TYPE_CHART[attacking_type][type_1]

    if type_2 is not None and type_2 != "" and type_2 != type_1:
        if type_2 not in TYPE_CHART[attacking_type]:
            logger.warning("Unknown defending type_2: %r", type_2)
        else:
            mult *= TYPE_CHART[attacking_type][type_2]

    return mult


def get_all_defensive_matchups(type_1: str, type_2: str | None) -> dict[str, float]:
    """
    Compute defensive multipliers against all 18 attacking types for a Pokémon.

    Args:
        type_1: Primary type (lowercase).
        type_2: Secondary type or None.

    Returns:
        Dict mapping each attacking type name to its combined multiplier.
        Example: {"normal": 1.0, "fire": 0.5, "water": 2.0, ...}
    """
    return {
        atk_type: get_defensive_multiplier(type_1, type_2, atk_type)
        for atk_type in TYPES
    }


def get_offensive_coverage(pokemon_type: str) -> list[str]:
    """
    Return a list of defending types that this Pokémon type hits for 2.0x (super effective).

    Args:
        pokemon_type: The attacking Pokémon's type (lowercase).

    Returns:
        List of type strings that are weak to this type.
    """
    if pokemon_type not in TYPE_CHART:
        logger.warning("Unknown type for offensive coverage: %r", pokemon_type)
        return []

    return [
        defending_type
        for defending_type, multiplier in TYPE_CHART[pokemon_type].items()
        if multiplier >= 2.0
    ]


def compute_type_advantage_score(
    attacker_types: tuple[str, ...],
    defender_types: tuple[str, ...]
) -> float:
    """
    Compute the offensive type-advantage multiplier from an attacker against a defender.

    Uses the best possible multiplier across all of the attacker's types against the
    combined defensive typing of the defender.

    Args:
        attacker_types: Tuple of 1-2 type strings for the attacking Pokémon.
        defender_types: Tuple of 1-2 type strings for the defending Pokémon.

    Returns:
        The maximum combined multiplier achievable (e.g. 4.0 for quad weakness).
    """
    if not attacker_types or not defender_types:
        return 1.0

    def_type_1 = defender_types[0]
    def_type_2 = defender_types[1] if len(defender_types) > 1 else None

    best_mult = 0.0
    for atk_type in attacker_types:
        if not atk_type:
            continue
        mult = get_defensive_multiplier(def_type_1, def_type_2, atk_type)
        if mult > best_mult:
            best_mult = mult

    return best_mult if best_mult > 0.0 else 1.0
