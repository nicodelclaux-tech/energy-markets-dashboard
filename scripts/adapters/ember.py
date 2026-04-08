"""
scripts/adapters/ember.py
-------------------------
Fetches EU-27 monthly electricity data from Ember Climate's v1 API using a
discovery-first approach.

Datasets fetched:
  - electricity-generation/monthly
  - electricity-demand/monthly
  - power-sector-emissions/monthly
  - carbon-intensity/monthly
  - installed-capacity/monthly  (wind/solar capacity, covers ~25 EU countries)

API key is read from the EMBER_API_KEY env var and passed as the ``api_key``
query parameter (not as an Authorization header).

For each dataset the adapter first calls Ember's options endpoints to discover
which EU-27 countries are supported and what the latest available month is,
then fetches data in batched requests using comma-separated entity filters.

Output files written to data/raw/:
  ember_eu_monthly_generation.json
  ember_eu_monthly_demand.json
  ember_eu_monthly_emissions.json
  ember_eu_monthly_carbon_intensity.json
  ember_eu_monthly_capacity.json
  ember_eu_monthly_manifest.json

The existing pipeline (fetch_all.py → build_data_js.py) is unaffected:
``fetch_all()`` returns a dict compatible with the orchestrator, and
build_data_js.py does not (yet) read these new JSON files.
"""

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from config.settings import (
    DATA_RAW_DIR,
    EMBER_API_KEY,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_BACKOFF,
)

logger = logging.getLogger(__name__)

EMBER_API_BASE = "https://api.ember-energy.org"

# Fixed start month for all datasets (YYYY-MM format expected by Ember API).
EMBER_START_MONTH = "2021-01"

# Number of countries to include in a single batched request.
BATCH_SIZE = 10

# EU-27 member states by their Ember entity display name.
# Used to intersect against the list returned by the options endpoint so we
# never assume a spelling that Ember might not recognise.
EU_27: list[str] = [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia",
    "Denmark", "Estonia", "Finland", "France", "Germany", "Greece",
    "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg",
    "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia",
    "Slovenia", "Spain", "Sweden",
]

# ---------------------------------------------------------------------------
# Dataset configuration
# ---------------------------------------------------------------------------
# Key: Ember base-dataset path (used in /v1/{key}/monthly and
#      /v1/options/{key}/monthly/{field}).
# has_series:  whether to fetch series options and pass is_aggregate_series.
# output_file: filename under data/raw/.
# fields:      columns to preserve in the output JSON.
DATASET_CONFIG: dict[str, dict] = {
    "electricity-generation": {
        "output_file": "ember_eu_monthly_generation.json",
        "has_series": True,
        "fields": [
            "entity", "entity_code", "date", "series",
            "generation_twh", "share_of_generation_pct",
        ],
    },
    "electricity-demand": {
        "output_file": "ember_eu_monthly_demand.json",
        "has_series": False,
        "fields": ["entity", "entity_code", "date", "demand_twh"],
    },
    "power-sector-emissions": {
        "output_file": "ember_eu_monthly_emissions.json",
        "has_series": True,
        "fields": [
            "entity", "entity_code", "date", "series",
            "emissions_mtco2", "share_of_emissions_pct",
        ],
    },
    "carbon-intensity": {
        "output_file": "ember_eu_monthly_carbon_intensity.json",
        "has_series": False,
        "fields": ["entity", "entity_code", "date", "emissions_intensity_gco2_per_kwh"],
    },
    "installed-capacity": {
        "output_file": "ember_eu_monthly_capacity.json",
        "has_series": True,
        "fields": [
            "entity", "entity_code", "date", "series",
            "capacity_gw", "capacity_w_per_capita",
        ],
    },
}


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _should_retry(exc: BaseException) -> bool:
    if isinstance(exc, requests.HTTPError):
        return exc.response is not None and exc.response.status_code in (429, 500, 502, 503)
    return isinstance(exc, (requests.ConnectionError, requests.Timeout))


@retry(
    retry=retry_if_exception(_should_retry),
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=RETRY_BACKOFF, min=2, max=60),
    reraise=True,
)
def _get(url: str, params: Optional[dict] = None) -> requests.Response:
    resp = requests.get(url, params=params or {}, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp


# ---------------------------------------------------------------------------
# Discovery helpers
# ---------------------------------------------------------------------------

def _get_options(dataset_key: str, field: str) -> list:
    """
    Call Ember's options endpoint for *dataset_key* / *field* and return the
    list of valid values.  Returns an empty list on any error.

    URL pattern: /v1/options/{dataset_key}/monthly/{field}
    """
    url = f"{EMBER_API_BASE}/v1/options/{dataset_key}/monthly/{field}"
    params: dict = {}
    if EMBER_API_KEY:
        params["api_key"] = EMBER_API_KEY
    try:
        resp = _get(url, params)
        data = resp.json()
        return data.get("data", [])
    except Exception as exc:
        logger.warning("Ember options fetch failed (%s / %s): %s", dataset_key, field, exc)
        return []


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

def _fetch_dataset_batched(
    dataset_key: str,
    entities: list[str],
    start_month: str,
    end_month: str,
    series_list: Optional[list[str]],
    has_series: bool,
) -> list[dict]:
    """
    Fetch all data for *entities* from *dataset_key* between *start_month* and
    *end_month*, splitting *entities* into batches of ``BATCH_SIZE``.

    Returns a flat list of raw record dicts from the Ember API response.
    """
    records: list[dict] = []
    n_batches = (len(entities) + BATCH_SIZE - 1) // BATCH_SIZE

    for batch_idx in range(n_batches):
        batch = entities[batch_idx * BATCH_SIZE:(batch_idx + 1) * BATCH_SIZE]
        params: dict = {
            "entity": ",".join(batch),
            "start_date": start_month,
            "end_date": end_month,
        }
        if EMBER_API_KEY:
            params["api_key"] = EMBER_API_KEY
        if has_series:
            params["is_aggregate_series"] = "false"
            if series_list:
                params["series"] = ",".join(series_list)

        url = f"{EMBER_API_BASE}/v1/{dataset_key}/monthly"
        try:
            resp = _get(url, params)
            batch_records = resp.json().get("data", [])
            records.extend(batch_records)
            logger.info(
                "Ember %s: batch %d/%d — %d records",
                dataset_key, batch_idx + 1, n_batches, len(batch_records),
            )
        except Exception as exc:
            logger.warning(
                "Ember %s: batch %d/%d failed (entities=%s…): %s",
                dataset_key, batch_idx + 1, n_batches, batch[:3], exc,
            )

    return records


# ---------------------------------------------------------------------------
# Main fetch logic
# ---------------------------------------------------------------------------

def fetch_eu_monthly() -> dict[str, list]:
    """
    Fetch all EU-27 monthly Ember datasets using discovery-first approach.

    For each dataset:
    1. Query ``/v1/options/{dataset}/monthly/entity`` to find which EU-27
       countries Ember actually supports.
    2. Query ``/v1/options/{dataset}/monthly/date`` to find the latest
       available month.
    3. If the dataset has series (generation / emissions / capacity), query
       ``/v1/options/{dataset}/monthly/series`` for valid series names.
    4. Fetch data in batched requests, preserving nulls.
    5. Write a normalized JSON file to ``data/raw/``.

    Returns a dict mapping dataset key → list of records (compatible with the
    ``fetch_all.py`` orchestrator which only needs a dict with ``__len__``
    values).
    """
    if not EMBER_API_KEY:
        logger.warning("EMBER_API_KEY not set — skipping Ember EU monthly fetch")
        return {}

    DATA_RAW_DIR.mkdir(parents=True, exist_ok=True)

    results: dict[str, list] = {}
    manifest: dict = {
        "pulled_at": datetime.now(timezone.utc).isoformat(),
        "api_base": EMBER_API_BASE,
        "latest_available_month_by_dataset": {},
        "countries_requested": EU_27,
        "countries_returned_by_dataset": {},
        "series_returned_by_dataset": {},
        "attribution": "Source: Ember, CC BY 4.0",
    }

    for dataset_key, config in DATASET_CONFIG.items():
        logger.info("=" * 50)
        logger.info("Ember: processing dataset %s", dataset_key)

        # --- 1. Discover supported EU-27 entities ---
        valid_entities = _get_options(dataset_key, "entity")
        valid_entities_set = set(valid_entities)
        supported = [c for c in EU_27 if c in valid_entities_set]
        unsupported = [c for c in EU_27 if c not in valid_entities_set]

        if unsupported:
            logger.info(
                "Ember %s: %d EU-27 countries not in options (skipping): %s",
                dataset_key, len(unsupported), unsupported,
            )

        if not supported:
            logger.warning(
                "Ember %s: no EU-27 countries found in options endpoint — skipping",
                dataset_key,
            )
            results[dataset_key] = []
            manifest["countries_returned_by_dataset"][dataset_key] = []
            manifest["series_returned_by_dataset"][dataset_key] = []
            continue

        # --- 2. Discover latest available month ---
        available_dates = _get_options(dataset_key, "date")
        end_month = max(available_dates) if available_dates else datetime.now(timezone.utc).strftime("%Y-%m")
        manifest["latest_available_month_by_dataset"][dataset_key] = end_month
        logger.info("Ember %s: date range %s → %s", dataset_key, EMBER_START_MONTH, end_month)

        # --- 3. Discover valid series (only for datasets that support it) ---
        series_list: Optional[list[str]] = None
        if config["has_series"]:
            series_list = _get_options(dataset_key, "series")
            manifest["series_returned_by_dataset"][dataset_key] = series_list
            logger.info("Ember %s: %d series available", dataset_key, len(series_list or []))
        else:
            manifest["series_returned_by_dataset"][dataset_key] = []

        # --- 4. Fetch data in batches ---
        raw_records = _fetch_dataset_batched(
            dataset_key,
            supported,
            EMBER_START_MONTH,
            end_month,
            series_list=series_list,
            has_series=config["has_series"],
        )

        # --- 5. Normalize: keep only requested fields, preserve nulls ---
        fields = config["fields"]
        filtered_records = [{f: rec.get(f) for f in fields} for rec in raw_records]

        returned_countries = sorted({r.get("entity") for r in raw_records if r.get("entity")})
        manifest["countries_returned_by_dataset"][dataset_key] = returned_countries

        results[dataset_key] = filtered_records

        # Write dataset JSON file
        output_path = DATA_RAW_DIR / config["output_file"]
        with open(output_path, "w", encoding="utf-8") as fh:
            json.dump(filtered_records, fh, ensure_ascii=False)
        logger.info(
            "Ember %s: wrote %d records → %s",
            dataset_key, len(filtered_records), output_path,
        )

    # Write manifest
    manifest_path = DATA_RAW_DIR / "ember_eu_monthly_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
    logger.info("Ember manifest written → %s", manifest_path)

    return results


def fetch_all() -> dict[str, list]:
    """Fetch EU-27 monthly Ember data and write JSON files to data/raw/."""
    return fetch_eu_monthly()
