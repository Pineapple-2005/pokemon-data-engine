"""
Extraction layer — PokéAPI fetch with disk caching.

All HTTP calls are rate-limited and wrapped in retry logic for 429 responses.
Failures are logged to data/logs/fetch_errors.log.
Cache layout:
    data/raw/pokemon/{name}.json
    data/raw/types/{type_name}.json
"""

import json
import logging
import time
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)


def _setup_error_log(log_dir: Path) -> None:
    """Attach a file handler for fetch errors if not already attached."""
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "fetch_errors.log"
    # Avoid duplicate handlers on repeated calls
    for handler in logger.handlers:
        if isinstance(handler, logging.FileHandler) and handler.baseFilename == str(log_path.resolve()):
            return
    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setLevel(logging.WARNING)
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(fh)


def _get(url: str, max_retries: int = 3, rate_limit_wait: int = 60) -> dict | None:
    """
    HTTP GET with rate-limit retry.

    Args:
        url:              Full URL to fetch.
        max_retries:      How many times to retry on 429 before giving up.
        rate_limit_wait:  Seconds to wait on a 429 response.

    Returns:
        Parsed JSON dict, or None on permanent failure.
    """
    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.get(url, timeout=30)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                logger.warning(
                    "Rate limited (429) on %s — waiting %ds (attempt %d/%d)",
                    url, rate_limit_wait, attempt, max_retries
                )
                time.sleep(rate_limit_wait)
            elif resp.status_code == 404:
                logger.error("404 Not Found: %s", url)
                return None
            else:
                logger.warning("HTTP %d on %s (attempt %d/%d)", resp.status_code, url, attempt, max_retries)
                time.sleep(2 ** attempt)
        except requests.RequestException as exc:
            logger.error("Request error on %s (attempt %d/%d): %s", url, attempt, max_retries, exc)
            time.sleep(2 ** attempt)

    logger.error("Permanently failed to fetch: %s after %d attempts", url, max_retries)
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_pokemon_list(limit: int, offset: int = 0, api_base: str = "https://pokeapi.co/api/v2") -> list[str]:
    """
    Fetch Pokémon names from PokéAPI with optional offset for region-specific fetches.

    Args:
        limit:    Number of Pokémon to retrieve (e.g. 151 for Gen 1).
        offset:   Starting index in the national Pokédex (0 = Bulbasaur).
                  Use 151 for Johto, 649 for Kalos, 721 for Alola.
        api_base: Base URL for PokéAPI.

    Returns:
        Ordered list of lowercase Pokémon name strings.
    """
    url = f"{api_base}/pokemon?limit={limit}&offset={offset}"
    data = _get(url)
    if data is None:
        logger.error("Failed to fetch Pokémon list from %s", url)
        return []
    results = data.get("results", [])
    names = [entry["name"] for entry in results if "name" in entry]
    logger.info("Fetched %d Pokémon names from API (offset=%d)", len(names), offset)
    return names


def fetch_pokemon(name: str, cache_dir: str, api_base: str = "https://pokeapi.co/api/v2") -> dict | None:
    """
    Fetch a single Pokémon's data from PokéAPI, using disk cache when available.

    Cache location: {cache_dir}/pokemon/{name}.json

    Args:
        name:      Pokémon name (lowercase, hyphenated — PokéAPI slug format).
        cache_dir: Root cache directory (e.g. "./data/raw").
        api_base:  PokéAPI base URL.

    Returns:
        Raw API dict, or None on fetch failure.
    """
    cache_path = Path(cache_dir) / "pokemon" / f"{name}.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    # Serve from cache if present
    if cache_path.exists():
        try:
            with cache_path.open(encoding="utf-8") as f:
                data = json.load(f)
            logger.debug("Cache hit: %s", name)
            return data
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Corrupt cache for %s (%s) — re-fetching", name, exc)
            cache_path.unlink(missing_ok=True)

    # Fetch from API
    url = f"{api_base}/pokemon/{name}"
    data = _get(url)

    if data is not None:
        try:
            with cache_path.open("w", encoding="utf-8") as f:
                json.dump(data, f)
            logger.debug("Cached %s", name)
        except OSError as exc:
            logger.warning("Could not write cache for %s: %s", name, exc)
    else:
        logger.error("Failed to fetch Pokémon: %s", name)

    # Rate limit between requests
    time.sleep(0.7)
    return data


def fetch_all_types(cache_dir: str, api_base: str = "https://pokeapi.co/api/v2") -> dict[str, dict]:
    """
    Fetch all 18 canonical Pokémon types from PokéAPI, using disk cache.

    Cache location: {cache_dir}/types/{type_name}.json

    Args:
        cache_dir: Root cache directory.
        api_base:  PokéAPI base URL.

    Returns:
        Dict mapping type name -> raw API type dict.
        Types that cannot be fetched are omitted.
    """
    from constants import TYPES  # local import to avoid circular-ish paths

    type_cache_dir = Path(cache_dir) / "types"
    type_cache_dir.mkdir(parents=True, exist_ok=True)

    type_data: dict[str, dict] = {}

    for type_name in TYPES:
        cache_path = type_cache_dir / f"{type_name}.json"

        # Serve from cache
        if cache_path.exists():
            try:
                with cache_path.open(encoding="utf-8") as f:
                    type_data[type_name] = json.load(f)
                logger.debug("Cache hit (type): %s", type_name)
                continue
            except (json.JSONDecodeError, OSError) as exc:
                logger.warning("Corrupt type cache for %s (%s) — re-fetching", type_name, exc)
                cache_path.unlink(missing_ok=True)

        # Fetch from API
        url = f"{api_base}/type/{type_name}"
        data = _get(url)

        if data is not None:
            type_data[type_name] = data
            try:
                with cache_path.open("w", encoding="utf-8") as f:
                    json.dump(data, f)
            except OSError as exc:
                logger.warning("Could not write type cache for %s: %s", type_name, exc)
        else:
            logger.error("Failed to fetch type: %s", type_name)

        time.sleep(0.7)

    logger.info("Fetched/loaded %d type records", len(type_data))
    return type_data


def run_extraction(
    limit: int = 151,
    offset: int = 0,
    cache_dir: str = "./data/raw",
    api_base: str = "https://pokeapi.co/api/v2",
) -> tuple[list[dict], dict[str, dict]]:
    """
    Main extraction entry point.

    Fetches `limit` Pokémon starting at `offset` plus all 18 type records from PokéAPI,
    using the disk cache to avoid redundant HTTP calls.

    Args:
        limit:     Number of Pokémon to extract.
        offset:    Starting index in the national Pokédex (0 = Kanto start,
                   151 = Johto start, 649 = Kalos start, 721 = Alola start).
        cache_dir: Root directory for raw JSON cache.
        api_base:  PokéAPI base URL.

    Returns:
        Tuple of:
            pokemon_list — list of raw Pokémon API dicts (len <= limit)
            type_data    — dict[type_name -> raw type API dict] (len <= 18)
    """
    # Wire up error log
    log_dir = Path(cache_dir).parent / "logs"
    _setup_error_log(log_dir)

    logger.info("Starting extraction: limit=%d, offset=%d, cache_dir=%s", limit, offset, cache_dir)

    names = fetch_pokemon_list(limit, offset=offset, api_base=api_base)
    if not names:
        logger.error("Extraction aborted — empty Pokémon name list")
        return [], {}

    pokemon_list: list[dict] = []
    for i, name in enumerate(names, start=1):
        data = fetch_pokemon(name, cache_dir=cache_dir, api_base=api_base)
        if data is not None:
            pokemon_list.append(data)
        else:
            logger.warning("Skipping %s (fetch failed)", name)

        if i % 25 == 0:
            logger.info("Extraction progress: %d/%d", i, len(names))

    type_data = fetch_all_types(cache_dir=cache_dir, api_base=api_base)

    logger.info(
        "Extraction complete: %d Pokémon, %d types",
        len(pokemon_list), len(type_data)
    )
    return pokemon_list, type_data
