"""
Name normalization utilities for PokéAPI compatibility.
Applies canonical transformations and override dict from constants.py.
"""

import logging
import re
import csv
from pathlib import Path

# Resolve constants.py from two directories up (ml/constants.py)
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from constants import NAME_OVERRIDES

logger = logging.getLogger(__name__)


def normalize_name(name: str) -> str:
    """
    Normalize a Pokémon name to its PokéAPI-compatible canonical form.

    Pipeline:
        1. Strip leading/trailing whitespace
        2. Lowercase
        3. Replace spaces with hyphens
        4. Remove periods and apostrophes
        5. Apply NAME_OVERRIDES lookup (checked both before and after transforms)

    Args:
        name: Raw name string (e.g. "Mr. Mime", "Farfetch'd", "Nidoran♀")

    Returns:
        Normalized name suitable for PokéAPI URL slug (e.g. "mr-mime", "farfetchd", "nidoran-f")
    """
    if not name or not isinstance(name, str):
        logger.warning("normalize_name received empty or non-string input: %r", name)
        return ""

    # Check override on original input first (before any transform)
    original_lower = name.strip().lower()
    if original_lower in NAME_OVERRIDES:
        return NAME_OVERRIDES[original_lower]

    # Standard transforms
    normalized = name.strip().lower()
    normalized = normalized.replace(" ", "-")
    normalized = re.sub(r"[.'']", "", normalized)

    # Re-check override after transforms
    if normalized in NAME_OVERRIDES:
        return NAME_OVERRIDES[normalized]

    return normalized


def load_assigned_csv(csv_path: str) -> set[str]:
    """
    Load an assigned Pokémon CSV file and return a set of normalized names.

    Expects the CSV to have at least one column containing Pokémon names.
    The first column is assumed to be the name column if no 'name' header is found.

    Args:
        csv_path: Absolute or relative path to the assigned_pokemon.csv file.

    Returns:
        Set of normalized name strings. Empty set if file does not exist.
    """
    path = Path(csv_path)
    if not path.exists():
        logger.warning("Assigned CSV not found at %s — returning empty set", csv_path)
        return set()

    assigned: set[str] = set()
    try:
        with path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []
            # Determine name column: prefer 'name', 'pokemon', 'pokemon_name'
            name_col: str | None = None
            for candidate in ("name", "pokemon", "pokemon_name", "pokemon name"):
                for h in headers:
                    if h.strip().lower() == candidate:
                        name_col = h
                        break
                if name_col:
                    break

            if name_col is None and headers:
                # Fall back to first column
                name_col = headers[0]
                logger.debug("No recognized name column; falling back to first column: %s", name_col)

            if name_col is None:
                # CSV with no headers — treat as single-column plain text
                f.seek(0)
                for line in f:
                    raw = line.strip()
                    if raw:
                        assigned.add(normalize_name(raw))
            else:
                for row in reader:
                    raw = row.get(name_col, "").strip()
                    if raw:
                        assigned.add(normalize_name(raw))

    except Exception as exc:
        logger.error("Failed to load assigned CSV from %s: %s", csv_path, exc)

    logger.info("Loaded %d assigned Pokémon from %s", len(assigned), csv_path)
    return assigned
