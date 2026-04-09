"""
scripts/adapters/gie.py
------------------------
Fetches European gas storage and LNG terminal data from GIE (Gas Infrastructure
Europe) via its AGSI and ALSI REST APIs.

Data sources
------------
AGSI  (https://agsi.gie.eu)  — underground gas storage levels for EU/EEA countries
ALSI  (https://alsi.gie.eu)  — LNG import terminal stock levels

Fields fetched per country per gas day
---------------------------------------
  gasInStorage       bcm  — working gas volume in storage
  workingGasVolume   bcm  — total working gas capacity
  full               %    — fill level (gasInStorage / workingGasVolume × 100)
  injection          bcm/day
  withdrawal         bcm/day
  trend              computed: daily Δfull and weekly Δfull (percentage-point change)

Trend computation
-----------------
Rather than relying on GIE's "trend" field (which is not always stable), this
adapter fetches up to 14 days of history per country and computes:
  trend_daily  = full(today) - full(yesterday)
  trend_weekly = full(today) - full(7 days ago)

Authentication
--------------
Both AGSI and ALSI require an API key sent as the ``x-key`` request header.
Set the environment variable / GitHub Actions secret ``GIE_API_KEY``.

Output files (data/raw/)
------------------------
  gie_gas_storage.json   — latest gas storage snapshot for all available countries
  gie_lng.json           — latest LNG snapshot for all available countries

Cache TTL: 20 hours (data is published once per gas day).

Required secret / environment variable:
  GIE_API_KEY — set in GitHub Actions secrets and .env for local runs
"""

import json
import logging
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import requests
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from config.series_map import GIE_GAS_COUNTRIES, GIE_LNG_COUNTRIES
from config.settings import (
    DATA_RAW_DIR,
    GIE_API_KEY,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_BACKOFF,
)

logger = logging.getLogger(__name__)

AGSI_BASE = "https://agsi.gie.eu/api"
ALSI_BASE = "https://alsi.gie.eu/api"

# Number of history days to fetch for trend computation
GIE_HISTORY_DAYS = 14

# Cache TTL: re-use cached files younger than this many hours
GIE_CACHE_TTL_HOURS = 20


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
def _get(base_url: str, params: dict) -> dict:
    """Execute one GIE API request.  API key is sent as a header, not a query param."""
    headers = {"x-key": GIE_API_KEY, "Accept": "application/json"}
    log_params = dict(params)
    resp = requests.get(base_url, params=log_params, headers=headers, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def _is_cache_fresh(path: Path) -> bool:
    if not path.exists() or path.stat().st_size == 0:
        return False
    age_hours = (time.time() - path.stat().st_mtime) / 3600
    return age_hours < GIE_CACHE_TTL_HOURS


# ---------------------------------------------------------------------------
# Data normalisation helpers
# ---------------------------------------------------------------------------

def _safe_float(val: Any) -> Optional[float]:
    try:
        return round(float(val), 4)
    except (TypeError, ValueError):
        return None


def _parse_day_record(record: dict) -> Optional[dict]:
    """
    Parse one day's gas-day record from the GIE API into a normalised dict.
    Returns None if the record cannot be parsed.
    """
    gas_day = record.get("gasDayStart") or record.get("gas_day_start")
    if not gas_day:
        return None

    return {
        "gasDay": str(gas_day)[:10],
        "gasInStorage": _safe_float(record.get("gasInStorage")),
        "workingGasVolume": _safe_float(record.get("workingGasVolume")),
        "full": _safe_float(record.get("full")),
        "injection": _safe_float(record.get("injection")),
        "withdrawal": _safe_float(record.get("withdrawal")),
        "injectionCapacity": _safe_float(record.get("injectionCapacity")),
        "withdrawalCapacity": _safe_float(record.get("withdrawalCapacity")),
        "status": record.get("status", ""),
    }


def _compute_trend(history: list[dict]) -> dict:
    """
    Given a list of day records sorted ascending by gasDay, compute daily and
    weekly fill-level deltas.

    Returns {"daily": float|null, "weekly": float|null, "unit": "%points"}
    """
    if not history:
        return {"daily": None, "weekly": None, "unit": "%points"}

    # Build a date → full% mapping, skipping entries where full is None
    by_date: dict[str, float] = {}
    for rec in history:
        if rec.get("full") is not None:
            by_date[rec["gasDay"]] = rec["full"]

    if not by_date:
        return {"daily": None, "weekly": None, "unit": "%points"}

    latest_date = max(by_date)
    latest_full = by_date[latest_date]

    # Daily: latest vs previous calendar day
    prev_date = (datetime.strptime(latest_date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    daily = None
    if prev_date in by_date:
        daily = round(latest_full - by_date[prev_date], 3)

    # Weekly: latest vs 7 calendar days ago
    week_ago = (datetime.strptime(latest_date, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")
    weekly = None
    if week_ago in by_date:
        weekly = round(latest_full - by_date[week_ago], 3)

    return {"daily": daily, "weekly": weekly, "unit": "%points"}


# ---------------------------------------------------------------------------
# Fetchers
# ---------------------------------------------------------------------------

def _fetch_country_history(base_url: str, country: str) -> list[dict]:
    """
    Fetch up to GIE_HISTORY_DAYS of history for *country* from *base_url*.
    Returns a list of normalised day records sorted ascending by gasDay.
    """
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=GIE_HISTORY_DAYS)

    params = {
        "country": country,
        "from": start_dt.strftime("%Y-%m-%d"),
        "to": end_dt.strftime("%Y-%m-%d"),
        "size": GIE_HISTORY_DAYS + 2,
        "page": 1,
    }

    try:
        payload = _get(base_url, params)
    except Exception as exc:
        logger.warning("GIE history fetch failed for %s (%s): %s", country, base_url, exc)
        return []

    # GIE API wraps results in a "data" key; sometimes it returns the list directly
    if isinstance(payload, dict):
        raw = payload.get("data", payload.get("gasstorages", []))
    elif isinstance(payload, list):
        raw = payload
    else:
        raw = []

    records = []
    for item in raw:
        parsed = _parse_day_record(item)
        if parsed:
            records.append(parsed)

    records.sort(key=lambda r: r["gasDay"])
    return records


def _build_country_snapshot(history: list[dict], country: str) -> Optional[dict]:
    """
    Build the country-level snapshot dict from *history*.
    Returns None if there are no usable records.
    """
    if not history:
        return None

    latest = history[-1]  # history is sorted ascending
    trend = _compute_trend(history)

    return {
        "country": country,
        "gasDay": latest["gasDay"],
        "gasInStorage": latest["gasInStorage"],
        "workingGasVolume": latest["workingGasVolume"],
        "full": latest["full"],
        "injection": latest["injection"],
        "withdrawal": latest["withdrawal"],
        "injectionCapacity": latest["injectionCapacity"],
        "withdrawalCapacity": latest["withdrawalCapacity"],
        "status": latest["status"],
        "trend": trend,
    }


def fetch_gas_storage() -> dict[str, Any]:
    """
    Fetch underground gas storage data for all GIE_GAS_COUNTRIES.

    Returns a dict keyed by ISO-2 country code.
    Caches the result to data/raw/gie_gas_storage.json.
    """
    cache_path = DATA_RAW_DIR / "gie_gas_storage.json"

    if _is_cache_fresh(cache_path):
        logger.info("GIE gas storage cache hit: %s", cache_path.name)
        try:
            with open(cache_path, encoding="utf-8") as fh:
                return json.load(fh)
        except Exception as exc:
            logger.warning("GIE gas cache read error: %s", exc)

    result: dict[str, Any] = {}
    for country in GIE_GAS_COUNTRIES:
        logger.info("GIE gas storage: fetching %s", country)
        history = _fetch_country_history(AGSI_BASE, country)
        snapshot = _build_country_snapshot(history, country)
        if snapshot:
            result[country] = snapshot
        else:
            logger.debug("GIE gas storage: no data for %s (skipping)", country)

    with open(cache_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2, sort_keys=True)
    logger.info("GIE gas storage: %d countries cached → %s", len(result), cache_path.name)
    return result


def fetch_lng() -> dict[str, Any]:
    """
    Fetch LNG terminal inventory data for all GIE_LNG_COUNTRIES.

    Returns a dict keyed by ISO-2 country code.
    Caches the result to data/raw/gie_lng.json.
    """
    cache_path = DATA_RAW_DIR / "gie_lng.json"

    if _is_cache_fresh(cache_path):
        logger.info("GIE LNG cache hit: %s", cache_path.name)
        try:
            with open(cache_path, encoding="utf-8") as fh:
                return json.load(fh)
        except Exception as exc:
            logger.warning("GIE LNG cache read error: %s", exc)

    result: dict[str, Any] = {}
    for country in GIE_LNG_COUNTRIES:
        logger.info("GIE LNG: fetching %s", country)
        history = _fetch_country_history(ALSI_BASE, country)
        snapshot = _build_country_snapshot(history, country)
        if snapshot:
            result[country] = snapshot
        else:
            logger.debug("GIE LNG: no data for %s (skipping)", country)

    with open(cache_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2, sort_keys=True)
    logger.info("GIE LNG: %d countries cached → %s", len(result), cache_path.name)
    return result


# ---------------------------------------------------------------------------
# Adapter entry point
# ---------------------------------------------------------------------------

def fetch_all() -> dict:
    """
    Fetch all GIE data (gas storage + LNG) and return a summary dict.
    Called by scripts/fetch_all.py as part of the main pipeline.
    """
    if not GIE_API_KEY:
        logger.warning("GIE_API_KEY not set — GIE adapter skipped")
        return {}

    gas = fetch_gas_storage()
    lng = fetch_lng()

    summary = {
        "gas_countries": sorted(gas.keys()),
        "lng_countries": sorted(lng.keys()),
        "gas_country_count": len(gas),
        "lng_country_count": len(lng),
    }
    logger.info("GIE fetch complete: %s", summary)
    return summary
