"""
Team-level feature construction for Engine 3 battle prediction.

Builds differential features (team A minus team B) that the ML model uses
to predict which team wins a simulated battle.
"""

import logging
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from constants import TYPES, ROLES
from utils.type_chart import get_defensive_multiplier, get_offensive_coverage, compute_type_advantage_score

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Team-level helpers
# ---------------------------------------------------------------------------

def get_team_type_coverage(team: list[dict]) -> int:
    """
    Count the number of unique types the team can hit super-effectively (2.0x).

    Aggregates offensive coverage across all unique types present on the team
    (both type_1 and type_2 for each member).

    Args:
        team: List of Pokémon dicts. Each dict must contain 'type_1' and optionally 'type_2'.

    Returns:
        Integer count of distinct defending types the team covers at 2.0x.
    """
    covered: set[str] = set()
    seen_atk_types: set[str] = set()

    for poke in team:
        t1 = (poke.get("type_1") or "").lower().strip()
        t2 = (poke.get("type_2") or "").lower().strip() or None

        for atk_type in filter(None, [t1, t2]):
            if atk_type in seen_atk_types:
                continue
            seen_atk_types.add(atk_type)
            for defending_type in get_offensive_coverage(atk_type):
                covered.add(defending_type)

    return len(covered)


def get_team_weakness_overlap(team: list[dict]) -> int:
    """
    Count types that hit 3 or more team members for 2.0x damage (weakness overlap).

    High overlap means the team is brittle against a single type — useful feature
    for team composition quality assessment.

    Args:
        team: List of Pokémon dicts with 'type_1' and optionally 'type_2'.

    Returns:
        Integer count of types that threaten 3+ team members at 2.0x.
    """
    # For each of the 18 attacking types, count how many team members are weak (>=2.0x)
    overlap_count = 0
    for atk_type in TYPES:
        threatened = 0
        for poke in team:
            t1 = (poke.get("type_1") or "").lower().strip()
            t2 = (poke.get("type_2") or "").lower().strip() or None
            if not t1:
                continue
            mult = get_defensive_multiplier(t1, t2, atk_type)
            if mult >= 2.0:
                threatened += 1
        if threatened >= 3:
            overlap_count += 1

    return overlap_count


def _safe_avg(team: list[dict], key: str) -> float:
    """Compute the average of a numeric field across team members, ignoring None/missing."""
    values = [v for poke in team if (v := poke.get(key)) is not None]
    return sum(values) / len(values) if values else 0.0


def _safe_sum(team: list[dict], key: str) -> float:
    values = [v for poke in team if (v := poke.get(key)) is not None]
    return sum(values)


def _team_matchup_score(attack_team: list[dict], defend_team: list[dict]) -> float:
    """
    For each attacker, find its best type multiplier vs any single defender.
    Return the average across all attackers. Range ~[0, 4].

    Positive matchup_adv (A minus B) means A's types are more effective
    against B's actual Pokémon than vice versa — the key signal that counters
    should win over their specific target.
    """
    scores = []
    for atk in attack_team:
        atk_types = tuple(
            t.lower() for t in [atk.get("type_1"), atk.get("type_2")] if t
        )
        if not atk_types:
            continue
        best = max(
            (
                compute_type_advantage_score(
                    atk_types,
                    tuple(t.lower() for t in [d.get("type_1"), d.get("type_2")] if t),
                )
                for d in defend_team
                if d.get("type_1")
            ),
            default=1.0,
        )
        scores.append(best)
    return sum(scores) / len(scores) if scores else 1.0


def _speed_control(team: list[dict], opp: list[dict]) -> int:
    """Count team members faster than the opponent's average speed."""
    opp_avg = _safe_avg(opp, "speed")
    return sum(1 for p in team if (p.get("speed") or 0) > opp_avg)


def _dmg_matchup(attack_team: list[dict], defend_team: list[dict]) -> float:
    """Type-advantage score weighted by attacker's offensive stat / 150."""
    scores = []
    for atk in attack_team:
        atk_types = tuple(t.lower() for t in [atk.get("type_1"), atk.get("type_2")] if t)
        if not atk_types:
            continue
        best = max(
            (
                compute_type_advantage_score(
                    atk_types,
                    tuple(t.lower() for t in [d.get("type_1"), d.get("type_2")] if t),
                )
                for d in defend_team
                if d.get("type_1")
            ),
            default=1.0,
        )
        off = max(atk.get("attack") or 0, atk.get("sp_atk") or atk.get("special_attack") or 0)
        scores.append(best * (off / 150.0))
    return sum(scores) / len(scores) if scores else 1.0


def _compute_role_balance(team: list[dict]) -> float:
    """
    Score team role diversity on a 0–1 scale.

    A perfectly balanced team has all 5 distinct role labels represented.
    Score = unique_roles_present / total_roles_defined

    Args:
        team: List of Pokémon dicts with optional 'role_label'.

    Returns:
        Float in [0, 1].
    """
    roles_present = {poke.get("role_label") for poke in team if poke.get("role_label")}
    return len(roles_present) / len(ROLES) if ROLES else 0.0


# ---------------------------------------------------------------------------
# Primary feature builder
# ---------------------------------------------------------------------------

def build_team_features(team_a: list[dict], team_b: list[dict]) -> dict:
    """
    Build 13 differential features for Engine 3 battle prediction.

    All features are expressed as (team_a_value - team_b_value) so that
    positive values indicate an advantage for team A.
    All features are differential so swapping Team A and Team B also swaps the
    sign of each feature.

    Expected dict keys on each Pokémon:
        type_1, type_2, hp, attack, defense, sp_atk, sp_def, speed,
        total_base_stats, weakness_count, role_label (optional)

    Args:
        team_a: List of Pokémon dicts for team A.
        team_b: List of Pokémon dicts for team B.

    Returns:
        Dict with keys:
            speed_adv          — avg speed A - avg speed B
            stat_adv           — avg total_base_stats A - B
            coverage_adv       — type coverage count A - B
            weakness_adv       — weakness_count B - A  (inverted: fewer weaknesses is better)
            hp_adv             — avg hp A - B
            atk_adv            — avg attack A - B
            sp_atk_adv         — avg sp_atk A - B
            def_adv            — avg defense A - B
            type_diversity_adv — unique type count A - B
            role_balance_adv   — role diversity score A - B
            matchup_adv        — head-to-head type matchup score A - B
            speed_control_adv  — count of A members faster than B avg minus reverse; range ~[-4,4]
            dmg_matchup_adv    — type-advantage weighted by offensive stat A - B
    """
    if not team_a or not team_b:
        logger.warning("build_team_features called with empty team(s)")
        return {k: 0.0 for k in [
            "speed_adv", "stat_adv", "coverage_adv", "weakness_adv",
            "hp_adv", "atk_adv", "sp_atk_adv", "def_adv",
            "type_diversity_adv", "role_balance_adv", "matchup_adv",
            "speed_control_adv", "dmg_matchup_adv",
        ]}

    coverage_a = get_team_type_coverage(team_a)
    coverage_b = get_team_type_coverage(team_b)

    weakness_a = _safe_avg(team_a, "weakness_count")
    weakness_b = _safe_avg(team_b, "weakness_count")

    types_a = {
        t
        for poke in team_a
        for t in [poke.get("type_1"), poke.get("type_2")]
        if t
    }
    types_b = {
        t
        for poke in team_b
        for t in [poke.get("type_1"), poke.get("type_2")]
        if t
    }

    return {
        "speed_adv":          _safe_avg(team_a, "speed") - _safe_avg(team_b, "speed"),
        "stat_adv":           _safe_avg(team_a, "total_base_stats") - _safe_avg(team_b, "total_base_stats"),
        "coverage_adv":       float(coverage_a - coverage_b),
        "weakness_adv":       weakness_b - weakness_a,           # inverted: less weakness = better
        "hp_adv":             _safe_avg(team_a, "hp") - _safe_avg(team_b, "hp"),
        "atk_adv":            _safe_avg(team_a, "attack") - _safe_avg(team_b, "attack"),
        "sp_atk_adv":         _safe_avg(team_a, "sp_atk") - _safe_avg(team_b, "sp_atk"),
        "def_adv":            _safe_avg(team_a, "defense") - _safe_avg(team_b, "defense"),
        "type_diversity_adv": float(len(types_a) - len(types_b)),
        "role_balance_adv":   _compute_role_balance(team_a) - _compute_role_balance(team_b),
        "matchup_adv":        _team_matchup_score(team_a, team_b) - _team_matchup_score(team_b, team_a),
        "speed_control_adv":  float(_speed_control(team_a, team_b) - _speed_control(team_b, team_a)),
        "dmg_matchup_adv":    _dmg_matchup(team_a, team_b) - _dmg_matchup(team_b, team_a),
    }
