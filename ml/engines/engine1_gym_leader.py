"""
Engine 1 — Gym Leader Team Generator
======================================
Builds a 6-Pokémon themed team for a Gym Leader using:
  • K-Means clustering (k=5) on stat features → cluster role assignment
  • Decision Tree (max_depth=5) → role prediction for each Pokémon
  • Random Forest (n_estimators=50) → usefulness scoring
  • Cosine Similarity → Ace selection (closest to theme centroid)
  • Gower's Distance → diversity enforcement
  • Difficulty scaling → filter by total_base_stats percentile

Input arrives from the FastAPI route as a plain Python dict (already validated by Pydantic).
All model objects are created, trained, and discarded per-request (stateless).
"""

from __future__ import annotations

import logging
import math
import random
from typing import Any, Optional

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics.pairwise import cosine_similarity

from ml.constants import TYPE_CHART, TYPES, ROLES

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Stat feature columns used throughout engine
# ---------------------------------------------------------------------------
STAT_COLS = ["hp", "attack", "defense", "sp_atk", "sp_def", "speed"]
SCALED_COLS = ["hp_scaled", "attack_scaled", "defense_scaled",
               "sp_atk_scaled", "sp_def_scaled", "speed_scaled"]

# Role slot definitions for team assembly
ROLE_SLOTS = ["ace", "sweeper", "tank", "wall", "support", "balanced"]
REQUIRED_TEAM_SIZE = 6

# Difficulty stat percentile cutoffs (select from this fraction of the pool)
DIFFICULTY_CONFIG = {
    "easy":   {"percentile_lo": 0,   "percentile_hi": 40},
    "medium": {"percentile_lo": 30,  "percentile_hi": 70},
    "hard":   {"percentile_lo": 60,  "percentile_hi": 100},
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(val: Any, default: float = 0.0) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _extract_stat_vector(pokemon: dict) -> np.ndarray:
    """Return a 6-element array of raw stat values."""
    return np.array([_safe_float(pokemon.get(c, 0)) for c in STAT_COLS])


def _extract_scaled_vector(pokemon: dict) -> np.ndarray:
    """Return a 6-element array of pre-scaled stat values (hp_scaled, etc.)."""
    return np.array([_safe_float(pokemon.get(c, 0)) for c in SCALED_COLS])


def _has_scaled_features(pokemon: dict) -> bool:
    return any(c in pokemon for c in SCALED_COLS)


def _normalize_matrix(X: np.ndarray) -> tuple[np.ndarray, MinMaxScaler]:
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)
    return X_scaled, scaler


def _weighted_quality_pick(
    candidates: list[dict],
    score_fn,
    rng: random.Random,
    avoid_names: Optional[set[str]] = None,
    quality_window: float = 0.10,
    max_candidates: int = 5,
) -> Optional[dict]:
    """Choose among near-best candidates while preferring a fresh lineup."""
    if not candidates:
        return None

    scored = sorted(
        [(candidate, float(score_fn(candidate))) for candidate in candidates],
        key=lambda item: item[1],
        reverse=True,
    )
    best_score = scored[0][1]
    eligible = [
        item for item in scored
        if item[1] >= best_score - quality_window
    ][:max_candidates]

    avoid_names = avoid_names or set()
    fresh = [item for item in eligible if item[0].get("name") not in avoid_names]
    pool = fresh or eligible
    floor = min(score for _, score in pool)
    weights = [1.0 + max(0.0, score - floor) * 8.0 for _, score in pool]
    return rng.choices([candidate for candidate, _ in pool], weights=weights, k=1)[0]


# ---------------------------------------------------------------------------
# Gower distance (categorical + numeric mixed, here pure numeric)
# ---------------------------------------------------------------------------

def _gower_distance_matrix(X: np.ndarray) -> np.ndarray:
    """Compute pairwise Gower distance for a numeric matrix (values in [0,1]).
    Gower distance = mean absolute difference per feature (for numeric features).
    """
    n, d = X.shape
    dist = np.zeros((n, n))
    for i in range(n):
        for j in range(i + 1, n):
            dist[i, j] = np.mean(np.abs(X[i] - X[j]))
            dist[j, i] = dist[i, j]
    return dist


def _most_diverse_candidate(
    current_team_indices: list[int],
    candidate_indices: list[int],
    X_scaled: np.ndarray,
) -> int:
    """Return the candidate index that maximises mean Gower distance to current team."""
    if not current_team_indices:
        return candidate_indices[0]

    team_vectors = X_scaled[current_team_indices]
    best_idx = candidate_indices[0]
    best_dist = -1.0
    for ci in candidate_indices:
        dists = np.mean(np.abs(X_scaled[ci] - team_vectors), axis=1)
        mean_dist = float(np.mean(dists))
        if mean_dist > best_dist:
            best_dist = mean_dist
            best_idx = ci
    return best_idx


# ---------------------------------------------------------------------------
# Role assignment heuristics
# ---------------------------------------------------------------------------

ROLE_HEURISTICS = {
    "sweeper":  lambda p: _safe_float(p.get("attack")) + _safe_float(p.get("sp_atk")) - _safe_float(p.get("defense")),
    "tank":     lambda p: _safe_float(p.get("hp")) + _safe_float(p.get("defense")) + _safe_float(p.get("sp_def")),
    "wall":     lambda p: _safe_float(p.get("defense")) + _safe_float(p.get("sp_def")) - _safe_float(p.get("attack")),
    "support":  lambda p: _safe_float(p.get("sp_def")) + _safe_float(p.get("speed")) - _safe_float(p.get("attack")),
    "balanced": lambda p: _safe_float(p.get("total_base_stats", 0)),
}


def _heuristic_role(pokemon: dict) -> str:
    existing = (pokemon.get("role_label") or "").lower()
    if existing in ROLES:
        return existing
    scores = {role: fn(pokemon) for role, fn in ROLE_HEURISTICS.items()}
    return max(scores, key=scores.__getitem__)


def _cluster_role_label(cluster_members: list[dict]) -> str:
    """Majority vote of heuristic roles within a cluster."""
    if not cluster_members:
        return "balanced"
    counts: dict[str, int] = {}
    for p in cluster_members:
        r = _heuristic_role(p)
        counts[r] = counts.get(r, 0) + 1
    return max(counts, key=counts.__getitem__)


# ---------------------------------------------------------------------------
# Main engine function
# ---------------------------------------------------------------------------

def generate_team(
    themes: Optional[list[str]] = None,
    difficulty: str = "medium",
    pokemon_pool: list[dict] = None,
    previous_team: Optional[list[str]] = None,
    previous_lineups: Optional[list[list[str]]] = None,
    variation_seed: Optional[int] = None,
    # backward-compat: old callers pass theme= as a positional/keyword arg
    theme: Optional[str] = None,
) -> dict:
    """
    Core logic for Engine 1.

    Parameters
    ----------
    themes      : list of Pokémon types (e.g. ["steel", "water"]) or ["balanced"]
    theme       : (legacy) single type string — ignored when themes is provided
    difficulty  : "easy" | "medium" | "hard"
    pokemon_pool: list of Pokémon dicts from NestJS (pre-enriched with role_label, stats)

    Returns
    -------
    dict matching the Engine1Response schema
    """
    # Resolve themes list — support both old single-theme and new multi-theme callers
    if themes is None or len(themes) == 0:
        # fall back to legacy theme kwarg
        themes = [theme if theme is not None else "balanced"]
    themes = [t.lower() for t in themes]

    # Keep a single theme string for output/logging (joined when multiple)
    theme_label = "/".join(themes)

    if pokemon_pool is None:
        raise ValueError("pokemon_pool is required")

    difficulty = difficulty.lower()
    previous_names = {name.lower() for name in (previous_team or [])}
    known_lineups = {
        frozenset(name.lower() for name in lineup)
        for lineup in (previous_lineups or [])
    }
    rng = random.Random(variation_seed)

    if not pokemon_pool:
        raise ValueError("No Pokémon available for theme")

    # ------------------------------------------------------------------
    # Step 1 — Filter pool by themes (ANY theme in the list matches)
    # ------------------------------------------------------------------
    if themes == ["balanced"]:
        filtered = list(pokemon_pool)
    else:
        filtered = [
            p for p in pokemon_pool
            if (p.get("type_1") or "").lower() in themes
            or (p.get("type_2") or "").lower() in themes
        ]

    if not filtered:
        raise ValueError(f"No Pokémon available for theme '{theme_label}'")

    # Guard: if the type-filtered pool itself is too small to build a full team,
    # expand it with the best off-theme Pokémon from the full pool.
    # This ensures narrow type+region combinations (e.g. Ghost/Paldea with only
    # 3 entries in the DB) can still produce a 6-member team.
    # We pad to REQUIRED_TEAM_SIZE * 3 so the downstream difficulty filter
    # still has a realistic pool to percentile-cut from.
    if len(filtered) < REQUIRED_TEAM_SIZE:
        filtered_names = {p.get("name") for p in filtered}
        extras_sorted = sorted(
            [p for p in pokemon_pool if p.get("name") not in filtered_names],
            key=lambda p: _safe_float(p.get("total_base_stats", p.get("total", 0))),
            reverse=True,
        )
        need = max(REQUIRED_TEAM_SIZE, REQUIRED_TEAM_SIZE * 3) - len(filtered)
        filtered = filtered + extras_sorted[:need]

    # ------------------------------------------------------------------
    # Step 2 — Apply difficulty scaling (filter by total_base_stats)
    # ------------------------------------------------------------------
    diff_cfg = DIFFICULTY_CONFIG.get(difficulty, DIFFICULTY_CONFIG["medium"])
    totals = [_safe_float(p.get("total_base_stats", p.get("total", 300))) for p in filtered]
    lo_thresh = float(np.percentile(totals, diff_cfg["percentile_lo"]))
    hi_thresh = float(np.percentile(totals, diff_cfg["percentile_hi"]))

    # For "easy" also use a hard cap so top-tier legends are excluded
    difficulty_filtered = [
        p for p, t in zip(filtered, totals)
        if lo_thresh <= t <= hi_thresh
    ]
    # Fallback: if the percentile filter leaves fewer than required Pokémon (too small a pool),
    # relax to the full filtered set so we can still build a complete team.
    if len(difficulty_filtered) < REQUIRED_TEAM_SIZE:
        difficulty_filtered = filtered

    # ------------------------------------------------------------------
    # Step 3 — Build feature matrix (use scaled if available, else normalise)
    # ------------------------------------------------------------------
    n = len(difficulty_filtered)

    if _has_scaled_features(difficulty_filtered[0]):
        X_raw = np.array([_extract_scaled_vector(p) for p in difficulty_filtered])
    else:
        X_raw = np.array([_extract_stat_vector(p) for p in difficulty_filtered])
        X_raw, _ = _normalize_matrix(X_raw)

    # Guard: clamp to [0, 1]
    X_raw = np.clip(X_raw, 0.0, 1.0)

    # ------------------------------------------------------------------
    # Step 4 — K-Means clustering (k=5, or min(n, 5) if pool is tiny)
    # ------------------------------------------------------------------
    k = min(5, n)
    silhouette = 0.0

    if n >= k and k >= 2:
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(X_raw)
        n_unique_labels = len(set(cluster_labels))
        # silhouette_score requires: 2 <= n_labels <= n_samples - 1
        if 2 <= n_unique_labels <= n - 1:
            silhouette = float(silhouette_score(X_raw, cluster_labels))
    else:
        cluster_labels = np.zeros(n, dtype=int)
        k = 1

    # Map cluster id → role label by majority vote
    cluster_to_role: dict[int, str] = {}
    for cid in range(k):
        members = [difficulty_filtered[i] for i, lbl in enumerate(cluster_labels) if lbl == cid]
        cluster_to_role[cid] = _cluster_role_label(members)

    # Assign cluster role back to each Pokémon (working copy)
    working_pool = []
    for i, p in enumerate(difficulty_filtered):
        p_copy = dict(p)
        p_copy["_cluster_role"] = cluster_to_role[cluster_labels[i]]
        p_copy["_original_index"] = i
        working_pool.append(p_copy)

    # ------------------------------------------------------------------
    # Step 5 — Decision Tree: predict role for each Pokémon
    # ------------------------------------------------------------------
    y_heuristic = np.array([_heuristic_role(p) for p in working_pool])

    if n >= 10:
        dt = DecisionTreeClassifier(max_depth=5, random_state=42)
        dt.fit(X_raw, y_heuristic)
        dt_roles = dt.predict(X_raw)
    else:
        dt_roles = y_heuristic  # too small to fit DT meaningfully

    for i, p in enumerate(working_pool):
        p["_dt_role"] = dt_roles[i]
        # Final role = DT prediction (trained on heuristic labels)
        p["_role"] = dt_roles[i]

    # ------------------------------------------------------------------
    # Step 6 — Random Forest: usefulness score
    # ------------------------------------------------------------------
    total_scaled_arr = np.array([
        _safe_float(p.get("total_base_stats", p.get("total", 300))) / 600.0
        for p in working_pool
    ]).reshape(-1, 1)

    # Binary target: top half = useful
    median_total = float(np.median(total_scaled_arr))
    y_useful = (total_scaled_arr.flatten() >= median_total).astype(int)

    if n >= 10 and len(set(y_useful)) == 2:
        rf = RandomForestClassifier(n_estimators=50, random_state=42)
        rf.fit(X_raw, y_useful)
        usefulness_scores = rf.predict_proba(X_raw)[:, 1]
    else:
        # Fallback: normalised total_base_stats as proxy score
        usefulness_scores = total_scaled_arr.flatten()

    for i, p in enumerate(working_pool):
        p["_usefulness_score"] = float(usefulness_scores[i])

    # ------------------------------------------------------------------
    # Step 7 — Cosine Similarity: compute theme centroid, select Ace
    # ------------------------------------------------------------------
    if themes != ["balanced"]:
        # theme_members = any Pokémon whose type1 or type2 is in the themes list
        theme_members = [
            p for p in working_pool
            if (p.get("type_1") or "").lower() in themes
            or (p.get("type_2") or "").lower() in themes
        ]
        if not theme_members:
            theme_members = working_pool
        centroid = np.mean(X_raw[[p["_original_index"] for p in theme_members]], axis=0).reshape(1, -1)
    else:
        centroid = np.mean(X_raw, axis=0).reshape(1, -1)

    cos_sims = cosine_similarity(X_raw, centroid).flatten()
    for i, p in enumerate(working_pool):
        p["_cos_sim"] = float(cos_sims[i])

    # Ace = one of the near-best theme fits. This preserves quality while
    # allowing repeat generations to rotate among tournament-worthy options.
    ace_pick = _weighted_quality_pick(
        working_pool,
        lambda p: 0.70 * p["_cos_sim"] + 0.30 * p["_usefulness_score"],
        rng,
        avoid_names=previous_names,
        quality_window=0.08,
        max_candidates=6,
    )
    ace_idx = ace_pick["_original_index"] if ace_pick is not None else int(np.argmax(cos_sims))
    working_pool[ace_idx]["_role"] = "ace"

    # ------------------------------------------------------------------
    # Step 8 — Team Assembly: 1 per role slot, Gower diversity
    # ------------------------------------------------------------------
    # Group candidates by role
    role_buckets: dict[str, list[dict]] = {r: [] for r in ROLE_SLOTS}
    for p in working_pool:
        role = p["_role"]
        if role in role_buckets:
            role_buckets[role].append(p)
        else:
            role_buckets["balanced"].append(p)

    # Sort each bucket by usefulness desc
    for role in ROLE_SLOTS:
        role_buckets[role].sort(key=lambda p: p["_usefulness_score"], reverse=True)

    selected_team: list[dict] = []
    selected_indices: list[int] = []
    used_names: set[str] = set()

    def _pick_for_role(role: str) -> Optional[dict]:
        candidates = [
            p for p in role_buckets.get(role, [])
            if p["name"] not in used_names
        ]
        if not candidates:
            return None

        def _candidate_score(candidate: dict) -> float:
            diversity = 0.0
            if selected_indices:
                dists = np.mean(
                    np.abs(X_raw[candidate["_original_index"]] - X_raw[selected_indices]),
                    axis=1,
                )
                diversity = float(np.mean(dists))
            return (
                0.68 * candidate["_usefulness_score"]
                + 0.22 * diversity
                + 0.10 * candidate["_cos_sim"]
            )

        return _weighted_quality_pick(
            candidates,
            _candidate_score,
            rng,
            avoid_names=previous_names,
            quality_window=0.10,
            max_candidates=5,
        )

    # Ace first
    ace_pick = _pick_for_role("ace")
    if ace_pick:
        selected_team.append(ace_pick)
        selected_indices.append(ace_pick["_original_index"])
        used_names.add(ace_pick["name"])

    # Remaining roles
    for role in ["sweeper", "tank", "wall", "support", "balanced"]:
        pick = _pick_for_role(role)
        if pick:
            selected_team.append(pick)
            selected_indices.append(pick["_original_index"])
            used_names.add(pick["name"])
        if len(selected_team) >= REQUIRED_TEAM_SIZE:
            break

    # If team still < required size, fill from remaining themed pool
    while len(selected_team) < REQUIRED_TEAM_SIZE:
        remaining = [p for p in working_pool if p["name"] not in used_names]
        pick = _weighted_quality_pick(
            remaining,
            lambda p: p["_usefulness_score"],
            rng,
            avoid_names=previous_names,
            quality_window=0.10,
            max_candidates=5,
        )
        if pick is None:
            break
        selected_team.append(pick)
        selected_indices.append(pick["_original_index"])
        used_names.add(pick["name"])

    # Fallback: themed pool too small — fill remaining slots from type-filtered pool
    # (using `filtered` not `pokemon_pool` to avoid off-type Pokémon appearing)
    if len(selected_team) < REQUIRED_TEAM_SIZE:
        while len(selected_team) < REQUIRED_TEAM_SIZE:
            fallback_pool = [p for p in filtered if p.get("name") not in used_names]
            p = _weighted_quality_pick(
                fallback_pool,
                lambda candidate: _safe_float(candidate.get("total_base_stats", candidate.get("total", 300))) / 600.0,
                rng,
                avoid_names=previous_names,
                quality_window=0.10,
                max_candidates=5,
            )
            if p is None:
                break
            p_copy = dict(p)
            p_copy["_role"] = _heuristic_role(p)
            p_copy["_usefulness_score"] = _safe_float(p.get("total_base_stats", p.get("total", 300))) / 600.0
            p_copy["_cos_sim"] = 0.0
            selected_team.append(p_copy)
            used_names.add(p["name"])

    # Ultimate fallback: fill any remaining slots from the full pokemon_pool
    # (reached only when both the themed pool and type-filtered pool are exhausted)
    if len(selected_team) < REQUIRED_TEAM_SIZE:
        while len(selected_team) < REQUIRED_TEAM_SIZE:
            ultimate_pool = [
                p for p in pokemon_pool
                if p.get("name") not in used_names
            ]
            p = _weighted_quality_pick(
                ultimate_pool,
                lambda candidate: _safe_float(candidate.get("total_base_stats", candidate.get("total", 300))) / 600.0,
                rng,
                avoid_names=previous_names,
                quality_window=0.10,
                max_candidates=5,
            )
            if p is None:
                break
            p_copy = dict(p)
            p_copy["_role"] = _heuristic_role(p)
            p_copy["_usefulness_score"] = _safe_float(p.get("total_base_stats", p.get("total", 300))) / 600.0
            p_copy["_cos_sim"] = 0.0
            selected_team.append(p_copy)
            used_names.add(p["name"])

    # A fresh seed can occasionally choose the same four names. If viable
    # themed alternatives exist, replace the weakest non-ace slot so clicking
    # Generate again visibly rotates the lineup.
    selected_name_set = {p["name"].lower() for p in selected_team}
    if selected_name_set == previous_names or frozenset(selected_name_set) in known_lineups:
        replaceable = [
            (index, p) for index, p in enumerate(selected_team)
            if p.get("_role") != "ace"
        ]
        if replaceable:
            replacement_options = []
            for replace_index, replaced in replaceable:
                replaced_name = replaced["name"].lower()
                for candidate in working_pool:
                    candidate_name = candidate["name"].lower()
                    next_lineup = frozenset(
                        (selected_name_set - {replaced_name}) | {candidate_name}
                    )
                    if candidate_name in selected_name_set or next_lineup in known_lineups:
                        continue
                    replacement_options.append({
                        "name": candidate["name"],
                        "candidate": candidate,
                        "replace_index": replace_index,
                        "_quality_score": (
                            candidate["_usefulness_score"]
                            - 0.35 * max(
                                0.0,
                                replaced.get("_usefulness_score", 0.0)
                                - candidate["_usefulness_score"],
                            )
                        ),
                    })
            replacement = _weighted_quality_pick(
                replacement_options,
                lambda option: option["_quality_score"],
                rng,
                avoid_names=previous_names,
                quality_window=0.10,
                max_candidates=5,
            )
            if replacement is not None:
                selected_team[replacement["replace_index"]] = replacement["candidate"]

    # ------------------------------------------------------------------
    # Step 9 — Build output
    # ------------------------------------------------------------------
    team_slots = []
    for slot_num, p in enumerate(selected_team[:REQUIRED_TEAM_SIZE], start=1):
        role = p.get("_role", "balanced")
        team_slots.append({
            "slot": slot_num,
            "role": role,
            "name": p.get("name", "unknown"),
            "pokeapi_id": p.get("pokeapi_id"),
            "type_1": p.get("type_1"),
            "type_2": p.get("type_2"),
            "total_base_stats": int(_safe_float(p.get("total_base_stats", p.get("total", 0)))),
            "usefulness_score": round(p["_usefulness_score"], 4),
            "reason": _build_slot_reason(p, role, theme_label),
        })

    roles_summary = ", ".join(
        f"{s['role']} ({s['name'].title()})" for s in team_slots
    )
    explanation = (
        f"Team built around {theme_label.title()} theme with roles: {roles_summary}. "
        f"Difficulty: {difficulty}. "
        f"Assembly used KMeans clustering, Decision Tree role assignment, "
        f"Random Forest usefulness scoring, and Gower diversity enforcement."
        f" Repeat generations rotate among near-best candidates."
    )

    return {
        "theme": theme_label,
        "difficulty": difficulty,
        "team": team_slots,
        "model_used": "kmeans+dt+rf+cosine+gower",
        "metrics": {
            "silhouette_score": round(silhouette, 4),
            "cluster_count": k,
            "pool_size": len(difficulty_filtered),
        },
        "explanation": explanation,
    }


def _build_slot_reason(pokemon: dict, role: str, theme: str) -> str:
    name = pokemon.get("name", "unknown").title()
    t1 = pokemon.get("type_1", "")
    t2 = pokemon.get("type_2", "")
    type_str = f"{t1}/{t2}" if t2 else t1
    total = int(_safe_float(pokemon.get("total_base_stats", pokemon.get("total", 0))))
    cos_sim = pokemon.get("_cos_sim", 0.0)

    base = f"{name} ({type_str}, BST {total}) selected as {role}."
    if role == "ace":
        base += f" Highest cosine similarity ({cos_sim:.2f}) to {theme} theme centroid."
    elif role == "sweeper":
        atk = int(_safe_float(pokemon.get("attack", 0)))
        sp_atk = int(_safe_float(pokemon.get("sp_atk", 0)))
        base += f" High offensive stats (ATK {atk}, SP.ATK {sp_atk})."
    elif role == "tank":
        hp = int(_safe_float(pokemon.get("hp", 0)))
        defense = int(_safe_float(pokemon.get("defense", 0)))
        base += f" High bulk (HP {hp}, DEF {defense})."
    elif role == "wall":
        defense = int(_safe_float(pokemon.get("defense", 0)))
        sp_def = int(_safe_float(pokemon.get("sp_def", 0)))
        base += f" Defensive wall (DEF {defense}, SP.DEF {sp_def})."
    elif role == "support":
        speed = int(_safe_float(pokemon.get("speed", 0)))
        base += f" Support utility (SPD {speed})."
    return base
