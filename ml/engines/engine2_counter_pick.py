"""
Engine 2 — Counter-Pick Engine
================================
Selects the best Pokémon from the assigned pool to counter a given opponent team.

Scoring formula (per candidate C vs opponent team O):
  TCS     = Type Coverage Score              (0.40 weight)
  KNN_S   = K-NN strong-counter probability  (0.25 weight)  — label from 1v1 simulation
  SAS     = Stat Advantage Score             (0.20 weight, normalised)
  DT_S    = Decision Tree probability        (0.15 weight)  — same 1v1 label
  VULN    = Vulnerability penalty            (-0.15)         — fraction of opponents that dominate C

  Final = 0.40*TCS + 0.25*KNN_S + 0.20*SAS_norm + 0.15*DT_S - 0.15*VULN

Post-selection: greedy diversity pass removes picks that share >1 weakness type with
already-selected members, replacing with the next-best diverse candidate from the top-8.

Stateless — all training happens per-request on the provided assigned_pool.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import numpy as np
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier

from ml.constants import TYPE_CHART, TYPES

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(val: Any, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _get_type_effectiveness(atk_type: Optional[str], def_type: Optional[str]) -> float:
    """Lookup TYPE_CHART[atk][def]. Returns 1.0 for unknown/None types."""
    if not atk_type or not def_type:
        return 1.0
    return TYPE_CHART.get(atk_type.lower(), {}).get(def_type.lower(), 1.0)


def _type_coverage_score(candidate: dict, opponent_team: list[dict]) -> float:
    """
    TCS for one candidate against the full opponent team.
    Uses additive weighting: primary-type matchup + 0.5 * secondary-type contributions.
    """
    c_t1 = (candidate.get("type_1") or "").lower()
    c_t2 = (candidate.get("type_2") or "").lower() or None

    total = 0.0
    for opp in opponent_team:
        o_t1 = (opp.get("type_1") or "").lower()
        o_t2 = (opp.get("type_2") or "").lower() or None

        total += _get_type_effectiveness(c_t1, o_t1)
        if o_t2:
            total += _get_type_effectiveness(c_t1, o_t2) * 0.5
        if c_t2:
            total += _get_type_effectiveness(c_t2, o_t1) * 0.5

    return total / max(len(opponent_team), 1)


def _stat_advantage_score(candidate: dict, opponent_team: list[dict]) -> float:
    """
    SAS = (C.total_base_stats - mean(opponent total_base_stats)) / 600
    Clamped to [-1.0, 1.0].
    """
    c_total = _safe_float(candidate.get("total_base_stats", candidate.get("total", 0)))
    if not opponent_team:
        return 0.0
    opp_totals = [
        _safe_float(o.get("total_base_stats", o.get("total", 0)))
        for o in opponent_team
    ]
    opp_mean = float(np.mean(opp_totals))
    return _clamp((c_total - opp_mean) / 600.0, -1.0, 1.0)


def _resistance_score(candidate: dict, opponent_team: list[dict]) -> float:
    """Fraction of opponents whose primary type C resists (incoming mult < 1.0)."""
    c_t1 = (candidate.get("type_1") or "").lower()
    c_t2 = (candidate.get("type_2") or "").lower() or None
    resistant_count = 0

    for opp in opponent_team:
        o_t1 = (opp.get("type_1") or "").lower()
        mult1 = _get_type_effectiveness(o_t1, c_t1)
        mult2 = _get_type_effectiveness(o_t1, c_t2) if c_t2 else 1.0
        if mult1 * mult2 < 1.0:
            resistant_count += 1

    return resistant_count / max(len(opponent_team), 1)


def _vulnerability_score(candidate: dict, opponent_team: list[dict]) -> float:
    """
    Fraction of opponents whose primary type hits C for >= 2x.
    Used as a penalty term — a strong counter that's 4x weak to the whole team is risky.
    """
    c_t1 = (candidate.get("type_1") or "").lower()
    c_t2 = (candidate.get("type_2") or "").lower() or None
    vuln_count = 0

    for opp in opponent_team:
        o_t1 = (opp.get("type_1") or "").lower()
        mult1 = _get_type_effectiveness(o_t1, c_t1)
        mult2 = _get_type_effectiveness(o_t1, c_t2) if c_t2 else 1.0
        if mult1 * mult2 >= 2.0:
            vuln_count += 1

    return vuln_count / max(len(opponent_team), 1)


def _simulate_1v1_score(candidate: dict, opponent: dict) -> float:
    """
    Estimate C's advantage in a 1v1 vs one opponent.
    Positive = C likely wins; negative = O likely wins.

    Uses damage-per-turn ratios and speed tiebreak.
    Returns a value in roughly [-1.3, 1.3].
    """
    c_t1 = (candidate.get("type_1") or "").lower()
    c_t2 = (candidate.get("type_2") or "").lower() or None
    o_t1 = (opponent.get("type_1") or "").lower()
    o_t2 = (opponent.get("type_2") or "").lower() or None

    # Best offensive multiplier C can use vs O
    c_mult = max(
        _get_type_effectiveness(c_t1, o_t1) * (_get_type_effectiveness(c_t1, o_t2) if o_t2 else 1.0),
        (_get_type_effectiveness(c_t2, o_t1) * (_get_type_effectiveness(c_t2, o_t2) if o_t2 else 1.0)) if c_t2 else 0.0,
    )
    # Best offensive multiplier O can use vs C
    o_mult = max(
        _get_type_effectiveness(o_t1, c_t1) * (_get_type_effectiveness(o_t1, c_t2) if c_t2 else 1.0),
        (_get_type_effectiveness(o_t2, c_t1) * (_get_type_effectiveness(o_t2, c_t2) if c_t2 else 1.0)) if o_t2 else 0.0,
    )

    c_off = max(_safe_float(candidate.get("attack", 0)), _safe_float(candidate.get("sp_atk", 0)))
    o_off = max(_safe_float(opponent.get("attack", 0)), _safe_float(opponent.get("sp_atk", 0)))
    c_def = max(_safe_float(candidate.get("defense", 0)) + _safe_float(candidate.get("sp_def", 0)), 1.0)
    o_def = max(_safe_float(opponent.get("defense", 0)) + _safe_float(opponent.get("sp_def", 0)), 1.0)
    c_hp  = max(_safe_float(candidate.get("hp", 0)), 1.0)
    o_hp  = max(_safe_float(opponent.get("hp", 0)), 1.0)

    c_dpt = max(c_mult * c_off / o_def, 0.01)
    o_dpt = max(o_mult * o_off / c_def, 0.01)

    c_ttko = o_hp / c_dpt   # turns for C to KO O
    o_ttko = c_hp / o_dpt   # turns for O to KO C

    ttko_diff = (o_ttko - c_ttko) / (o_ttko + c_ttko)  # range (-1, 1)

    c_speed = _safe_float(candidate.get("speed", 0))
    o_speed = _safe_float(opponent.get("speed", 0))
    speed_bonus = 0.1 if c_speed > o_speed else (-0.1 if c_speed < o_speed else 0.0)

    return ttko_diff + speed_bonus


def _build_feature_vector(pokemon: dict) -> np.ndarray:
    """Return a 10-feature vector used for KNN and DT scoring."""
    stat_cols = ["hp", "attack", "defense", "sp_atk", "sp_def", "speed"]
    stats = np.array([_safe_float(pokemon.get(c, 0)) for c in stat_cols])
    total = _safe_float(pokemon.get("total_base_stats", pokemon.get("total", 0)))
    stat_maxes = np.array([255, 190, 230, 194, 230, 200], dtype=float)
    norm_stats = stats / stat_maxes
    return np.append(norm_stats, [total / 700.0, 0.0, 0.0, 0.0])


def _train_ml_models(
    assigned_pool: list[dict],
    opponent_team: list[dict],
) -> tuple[KNeighborsClassifier, DecisionTreeClassifier, np.ndarray]:
    """
    Train KNN and DT on the assigned pool.
    Target: is_strong_counter = 1 if candidate wins majority of 1v1 simulations vs
    opponent team members — more informative than TCS > threshold.
    """
    X = np.array([_build_feature_vector(p) for p in assigned_pool])

    y = np.array([
        1 if sum(_simulate_1v1_score(p, opp) > 0 for opp in opponent_team) > len(opponent_team) / 2 else 0
        for p in assigned_pool
    ])

    n_pos = int(y.sum())
    n_neg = len(y) - n_pos

    if n_pos == 0 or n_neg == 0:
        # Fallback: rank by aggregate 1v1 score and label top half
        scores = [
            sum(_simulate_1v1_score(p, opp) for opp in opponent_team)
            for p in assigned_pool
        ]
        sorted_idx = sorted(range(len(assigned_pool)), key=lambda i: scores[i], reverse=True)
        y = np.zeros(len(assigned_pool), dtype=int)
        for idx in sorted_idx[: len(sorted_idx) // 2]:
            y[idx] = 1

    k_neighbors = min(5, max(1, len(assigned_pool) - 1))
    knn = KNeighborsClassifier(n_neighbors=k_neighbors)
    knn.fit(X, y)

    dt = DecisionTreeClassifier(max_depth=4, random_state=42)
    dt.fit(X, y)

    return knn, dt, X


# ---------------------------------------------------------------------------
# Diversity selection
# ---------------------------------------------------------------------------

def _shared_weakness_types(pokemon_list: list[dict]) -> set[str]:
    """Return types that hit >= 2 members of pokemon_list for 2x or more."""
    counts: dict[str, int] = {}
    for p in pokemon_list:
        t1 = (p.get("type_1") or "").lower()
        t2 = (p.get("type_2") or "").lower() or None
        for atk_type in TYPES:
            mult1 = _get_type_effectiveness(atk_type, t1)
            mult2 = _get_type_effectiveness(atk_type, t2) if t2 else 1.0
            if mult1 * mult2 >= 2.0:
                counts[atk_type] = counts.get(atk_type, 0) + 1
    return {t for t, c in counts.items() if c >= 2}


def _diversified_top_n(scored_candidates: list[dict], n: int) -> list[dict]:
    """
    Greedy selection from the top-8 candidates that minimises shared weaknesses.
    A candidate is skipped if adding it would create > 1 new shared weakness type,
    unless no better candidate remains.
    """
    pool = scored_candidates[:max(n * 2, 8)]
    if len(pool) <= n:
        return pool

    selected: list[dict] = []
    skipped: list[dict] = []

    for candidate in pool:
        if len(selected) >= n:
            break
        if not selected:
            selected.append(candidate)
            continue

        current_shared = _shared_weakness_types([s["pokemon"] for s in selected])
        new_shared = _shared_weakness_types([s["pokemon"] for s in selected] + [candidate["pokemon"]])
        added_shared = len(new_shared) - len(current_shared)

        remaining_pool = len(pool) - pool.index(candidate) - 1
        slots_left = n - len(selected)

        if added_shared <= 1 or remaining_pool < slots_left:
            selected.append(candidate)
        else:
            skipped.append(candidate)

    # Fill any remaining slots from skipped candidates
    if len(selected) < n:
        for candidate in skipped:
            if len(selected) >= n:
                break
            selected.append(candidate)

    return selected


# ---------------------------------------------------------------------------
# Matchup label helper
# ---------------------------------------------------------------------------

def _matchup_label(multiplier: float) -> str:
    if multiplier >= 2.0:
        return "super effective"
    elif 0.0 < multiplier <= 0.5:
        return "not very effective"
    elif multiplier == 0.0:
        return "immune"
    return "neutral"


def _build_reason(
    candidate: dict,
    opponent_team: list[dict],
    tcs: float,
    sas: float,
    knn_s: float,
    vulnerability: float,
) -> str:
    name = candidate.get("name", "unknown").title()
    t1 = candidate.get("type_1", "")
    t2 = candidate.get("type_2", "")
    type_str = f"{t1}/{t2}" if t2 else t1

    super_eff_vs = []
    for opp in opponent_team:
        o_t1 = (opp.get("type_1") or "").lower()
        o_t2 = (opp.get("type_2") or "").lower() or None
        c_t1 = (candidate.get("type_1") or "").lower()
        c_t2 = (candidate.get("type_2") or "").lower() or None
        best_mult = max(
            _get_type_effectiveness(c_t1, o_t1) * (_get_type_effectiveness(c_t1, o_t2) if o_t2 else 1.0),
            (_get_type_effectiveness(c_t2, o_t1) * (_get_type_effectiveness(c_t2, o_t2) if o_t2 else 1.0)) if c_t2 else 0.0,
        )
        if best_mult >= 2.0:
            super_eff_vs.append(opp.get("name", "?").title())

    reason = f"{name} ({type_str}) counter score {tcs:.2f} TCS."
    if super_eff_vs:
        reason += f" Super-effective vs: {', '.join(super_eff_vs[:3])}."
    if sas > 0.2:
        reason += f" Stat advantage (SAS {sas:.2f})."
    if knn_s > 0.6:
        reason += " 1v1 sim classifies as strong counter."
    if vulnerability > 0.5:
        reason += f" Warning: vulnerable to {int(vulnerability * 100)}% of opponent types."
    return reason


# ---------------------------------------------------------------------------
# Main engine function
# ---------------------------------------------------------------------------

def generate_counter_team(
    opponent_team_names: list[str],
    opponent_data: list[dict],
    assigned_pool: list[dict],
) -> dict:
    """
    Core logic for Engine 2.

    Parameters
    ----------
    opponent_team_names : list of opponent Pokémon names
    opponent_data       : full dicts for each opponent Pokémon
    assigned_pool       : dicts for each assigned (is_assigned=1) Pokémon

    Returns
    -------
    dict matching Engine2Response schema
    """
    if not assigned_pool:
        raise ValueError("No assigned Pokémon pool loaded")
    if not opponent_data:
        raise ValueError("No opponent team data provided")

    # ------------------------------------------------------------------
    # Step 1 — Train ML models on assigned pool (1v1-simulation labels)
    # ------------------------------------------------------------------
    knn, dt, X_pool = _train_ml_models(assigned_pool, opponent_data)

    # ------------------------------------------------------------------
    # Step 2 — Score each candidate
    # ------------------------------------------------------------------
    scored_candidates = []
    for i, candidate in enumerate(assigned_pool):
        tcs         = _type_coverage_score(candidate, opponent_data)
        sas_raw     = _stat_advantage_score(candidate, opponent_data)
        rs          = _resistance_score(candidate, opponent_data)
        vulnerability = _vulnerability_score(candidate, opponent_data)

        fv = X_pool[i].reshape(1, -1)
        classes = list(knn.classes_)
        knn_proba_all = knn.predict_proba(fv)[0]
        dt_proba_all  = dt.predict_proba(fv)[0]

        if 1 in classes:
            strong_idx = classes.index(1)
            knn_s = float(knn_proba_all[strong_idx])
            dt_s  = float(dt_proba_all[strong_idx])
        else:
            knn_s = 0.0
            dt_s  = 0.0

        sas_norm = (sas_raw + 1.0) / 2.0

        final_score = (
            0.40 * tcs
            + 0.25 * knn_s
            + 0.20 * sas_norm
            + 0.15 * dt_s
            - 0.15 * vulnerability
        )

        scored_candidates.append({
            "pokemon": candidate,
            "counter_score": final_score,
            "score_breakdown": {
                "tcs":           round(tcs, 4),
                "sas":           round(sas_raw, 4),
                "rs":            round(rs, 4),
                "knn":           round(knn_s, 4),
                "dt":            round(dt_s, 4),
                "vulnerability": round(vulnerability, 4),
            },
            "reason": _build_reason(candidate, opponent_data, tcs, sas_raw, knn_s, vulnerability),
        })

    # ------------------------------------------------------------------
    # Step 3 — Sort, then apply diversity re-rank
    # ------------------------------------------------------------------
    scored_candidates.sort(key=lambda x: x["counter_score"], reverse=True)
    top_picks = _diversified_top_n(scored_candidates, n=4)

    recommended_team = []
    for rank, entry in enumerate(top_picks, start=1):
        p = entry["pokemon"]
        recommended_team.append({
            "rank": rank,
            "name": p.get("name", "unknown"),
            "counter_score": round(entry["counter_score"], 4),
            "score_breakdown": entry["score_breakdown"],
            "type_1": p.get("type_1"),
            "type_2": p.get("type_2"),
            "total_base_stats": int(_safe_float(p.get("total_base_stats", p.get("total", 0)))),
            "reason": entry["reason"],
        })

    # ------------------------------------------------------------------
    # Step 4 — Matchup table for ALL top picks (not just top 2)
    # ------------------------------------------------------------------
    matchup_table: dict[str, dict] = {}
    for entry in top_picks:
        c_name = entry["pokemon"].get("name", "?")
        c_t1 = (entry["pokemon"].get("type_1") or "").lower()
        c_t2 = (entry["pokemon"].get("type_2") or "").lower() or None

        for opp in opponent_data:
            o_name = opp.get("name", "?")
            o_t1 = (opp.get("type_1") or "").lower()
            o_t2 = (opp.get("type_2") or "").lower() or None

            key = f"{c_name}_vs_{o_name}"
            mult_c_t1 = _get_type_effectiveness(c_t1, o_t1) * (
                _get_type_effectiveness(c_t1, o_t2) if o_t2 else 1.0
            )
            mult_c_t2 = (
                _get_type_effectiveness(c_t2, o_t1) * (
                    _get_type_effectiveness(c_t2, o_t2) if o_t2 else 1.0
                )
                if c_t2 else 0.0
            )
            best_mult = max(mult_c_t1, mult_c_t2) if mult_c_t1 > 0 or mult_c_t2 > 0 else mult_c_t1

            matchup_table[key] = {
                "advantage":  _matchup_label(best_mult),
                "multiplier": best_mult,
            }

    return {
        "opponent_team":     opponent_team_names,
        "recommended_team":  recommended_team,
        "model_used":        "tcs+1v1sim+knn+dt+diversity",
        "matchup_table":     matchup_table,
    }
