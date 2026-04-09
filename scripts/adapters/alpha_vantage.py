"""
scripts/adapters/alpha_vantage.py
----------------------------------
Fetches metals spot prices and news/sentiment from Alpha Vantage.

Metals fetched:
  - Gold   (XAU/USD) via FX_DAILY endpoint
  - Silver (XAG/USD) via FX_DAILY endpoint
  - Copper          via COPPER commodity endpoint

News/sentiment fetched:
  - Broad energy + commodities feed (NEWS_SENTIMENT)
  - Filtered post-fetch by country mentions and specific topics

Alpha Vantage rate limits (free tier): 25 req/day, 5 req/min.
This adapter makes at most 5 API calls per run and throttles with a
12-second sleep between calls to stay well within the per-minute limit.
Results are cached to ``data/raw/`` so repeat calls within the same run
(or within the cache TTL of 20 hours) skip the network entirely.

Required secret / environment variable:
  ALPHAVANTAGE_API_KEY  — set in GitHub Actions secrets and .env for local runs

Output files (data/raw/):
  av_gold.csv
  av_silver.csv
  av_copper.csv
  av_news.json
"""

import hashlib
import json
import logging
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from config.series_map import ALL_COUNTRIES, AV_METALS, AV_NEWS_TOPICS, NEWS_TOPICS
from config.settings import (
    ALPHAVANTAGE_API_KEY,
    DATA_RAW_DIR,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
)

logger = logging.getLogger(__name__)

AV_BASE = "https://www.alphavantage.co/query"

# Minimum seconds between consecutive Alpha Vantage API calls.
# 12 s keeps us under the 5 req/min free-tier limit with margin.
AV_THROTTLE_SECONDS = 12

# Cache TTL: re-use cached files if they are younger than this many hours.
AV_CACHE_TTL_HOURS = 20

_last_call_ts: float = 0.0  # module-level timestamp for inter-call throttling


def _throttle() -> None:
    """Block until at least AV_THROTTLE_SECONDS have passed since the last call."""
    global _last_call_ts
    elapsed = time.time() - _last_call_ts
    if elapsed < AV_THROTTLE_SECONDS:
        wait = AV_THROTTLE_SECONDS - elapsed
        logger.debug("Alpha Vantage throttle: sleeping %.1f s", wait)
        time.sleep(wait)
    _last_call_ts = time.time()


def _is_cache_fresh(path: Path) -> bool:
    """Return True if *path* exists and was modified within AV_CACHE_TTL_HOURS."""
    if not path.exists() or path.stat().st_size == 0:
        return False
    age_hours = (time.time() - path.stat().st_mtime) / 3600
    return age_hours < AV_CACHE_TTL_HOURS


def _get(params: dict) -> dict:
    """
    Execute a single GET request to the Alpha Vantage API with retry on
    transient errors (429, 5xx, connection/timeout).
    """
    params = {**params, "apikey": ALPHAVANTAGE_API_KEY}
    # Redact key for logging
    log_params = {k: ("***" if k == "apikey" else v) for k, v in params.items()}
    logger.info("Alpha Vantage request: %s", log_params)

    for attempt in range(1, MAX_RETRIES + 1):
        _throttle()
        try:
            resp = requests.get(AV_BASE, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            # Alpha Vantage signals rate-limit errors inside the JSON body
            if "Note" in data or "Information" in data:
                note = data.get("Note") or data.get("Information", "")
                logger.warning("Alpha Vantage API note (attempt %d/%d): %s", attempt, MAX_RETRIES, note[:120])
                if attempt < MAX_RETRIES:
                    time.sleep(60)  # back off a full minute on API-level throttling
                    continue
            return data
        except (requests.ConnectionError, requests.Timeout) as exc:
            logger.warning("Alpha Vantage request error (attempt %d/%d): %s", attempt, MAX_RETRIES, exc)
            if attempt < MAX_RETRIES:
                time.sleep(AV_THROTTLE_SECONDS * attempt)
        except requests.HTTPError as exc:
            code = exc.response.status_code if exc.response is not None else 0
            if code in (429, 500, 502, 503) and attempt < MAX_RETRIES:
                logger.warning("AV HTTP %d — retrying (attempt %d/%d)", code, attempt, MAX_RETRIES)
                time.sleep(AV_THROTTLE_SECONDS * attempt)
            else:
                raise

    return {}


# ---------------------------------------------------------------------------
# Metals price fetchers
# ---------------------------------------------------------------------------

def _fetch_fx_daily(from_symbol: str, to_symbol: str) -> pd.DataFrame:
    """
    Fetch compact (100-day) FX_DAILY series for a metal quoted as an
    ISO 4217-style currency code (XAU = gold, XAG = silver).
    """
    params = {
        "function": "FX_DAILY",
        "from_symbol": from_symbol,
        "to_symbol": to_symbol,
        "outputsize": "compact",
    }
    data = _get(params)
    ts_key = "Time Series FX (Daily)"
    ts = data.get(ts_key, {})
    if not ts:
        logger.warning("AV FX_DAILY: empty response for %s/%s", from_symbol, to_symbol)
        return pd.DataFrame()

    rows = []
    for date_str, ohlc in ts.items():
        try:
            rows.append({
                "date": date_str,
                "value": round(float(ohlc["4. close"]), 4),
            })
        except (KeyError, ValueError):
            continue

    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    df.sort_values("date", inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


def _fetch_commodity(function: str) -> pd.DataFrame:
    """
    Fetch a monthly commodity series (e.g. COPPER) from Alpha Vantage.
    Returns a tidy DataFrame with columns: date, value.
    """
    params = {"function": function, "interval": "monthly"}
    data = _get(params)
    raw_data = data.get("data", [])
    if not raw_data:
        logger.warning("AV commodity %s: empty response", function)
        return pd.DataFrame()

    rows = []
    for item in raw_data:
        try:
            val = float(item["value"])
            rows.append({"date": item["date"], "value": round(val, 4)})
        except (KeyError, ValueError, TypeError):
            continue

    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    df.sort_values("date", inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


def fetch_metals() -> dict[str, pd.DataFrame]:
    """
    Fetch gold, silver, and copper price series.

    Uses cached CSV files when they are younger than AV_CACHE_TTL_HOURS to
    avoid unnecessary API calls.

    Returns a dict: logical_name → DataFrame(date, value, unit, source)
    """
    if not ALPHAVANTAGE_API_KEY:
        logger.warning("ALPHAVANTAGE_API_KEY not set — skipping metals fetch")
        return {}

    results: dict[str, pd.DataFrame] = {}

    for metal, (function, from_sym, to_sym, unit, label) in AV_METALS.items():
        cache_path = DATA_RAW_DIR / f"av_{metal}.csv"

        if _is_cache_fresh(cache_path):
            logger.info("AV metals cache hit: %s (%s)", metal, cache_path.name)
            df = pd.read_csv(cache_path)
            results[metal] = df
            continue

        logger.info("Fetching AV metal: %s (%s)", metal, label)
        try:
            if function == "FX_DAILY":
                df = _fetch_fx_daily(from_sym, to_sym)
            else:
                df = _fetch_commodity(function)
        except Exception as exc:
            logger.warning("AV metal fetch failed for %s: %s", metal, exc)
            # Return cached stale data if available
            if cache_path.exists():
                df = pd.read_csv(cache_path)
                logger.warning("AV: using stale cache for %s", metal)
                results[metal] = df
            continue

        if df.empty:
            logger.warning("AV: no data returned for %s", metal)
            continue

        df["metal"] = metal
        df["unit"] = unit
        df["source"] = "alphavantage"
        df.to_csv(cache_path, index=False)
        logger.info("AV metals: %s — %d rows cached", metal, len(df))
        results[metal] = df

    return results


# ---------------------------------------------------------------------------
# News / sentiment
# ---------------------------------------------------------------------------

def _article_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:16]


def _detect_topics(text: str) -> list[str]:
    text_lower = text.lower()
    return [
        topic for topic, kws in NEWS_TOPICS.items()
        if any(kw.lower() in text_lower for kw in kws)
    ]


def _detect_countries(text: str) -> list[str]:
    text_lower = text.lower()
    return [
        code for code, name in ALL_COUNTRIES.items()
        if name.lower() in text_lower
    ]


def _normalise_article(item: dict) -> dict:
    """Convert a raw AV NEWS_SENTIMENT article into the pipeline's article schema."""
    title = item.get("title", "")
    summary = item.get("summary", "")
    url = item.get("url", "")
    published_at = item.get("time_published", "")
    # Reformat AV timestamp "20240101T120000" → "2024-01-01T12:00:00Z"
    if len(published_at) == 15 and "T" in published_at:
        try:
            published_at = (
                published_at[:4] + "-" + published_at[4:6] + "-" + published_at[6:8]
                + "T" + published_at[9:11] + ":" + published_at[11:13] + ":"
                + published_at[13:15] + "Z"
            )
        except Exception:
            pass

    country_tags = _detect_countries(f"{title} {summary}")
    topic_tags = _detect_topics(f"{title} {summary}")
    sentiment_label = item.get("overall_sentiment_label", "")
    sentiment_score = float(item.get("overall_sentiment_score", 0.0) or 0.0)

    # Derive a numeric relevance score consistent with the existing news_ranker formula
    kw_hits = sum(
        1 for kw in [
            "energy", "electricity", "power", "natural gas", "LNG", "wind", "solar",
            "nuclear", "coal", "oil", "renewables", "emissions", "carbon", "ETS",
            "electricity market", "energy crisis", "grid", "storage",
        ]
        if kw.lower() in f"{title} {summary}".lower()
    )
    relevance_score = round(
        min(kw_hits * 1.2, 6.0)
        + min(len(topic_tags) * 0.5, 2.0)
        + min(len(country_tags) * 0.5, 2.0),
        1,
    )

    return {
        "id": _article_id(url),
        "headline": title,
        "url": url,
        "publishedAt": published_at,
        "source": "alphavantage",
        "country_tags": country_tags,
        "topic_tags": topic_tags,
        "summary": summary,
        "relevance_score": relevance_score,
        "sentiment": {
            "label": sentiment_label,
            "score": round(sentiment_score, 4),
        },
        "av_topics": [t.get("topic", "") for t in item.get("topics", [])],
    }


def _fetch_news_page(topics: str, limit: int = 50) -> list[dict]:
    """Fetch one page of NEWS_SENTIMENT articles for the given topic string."""
    params = {
        "function": "NEWS_SENTIMENT",
        "topics": topics,
        "limit": limit,
        "sort": "RELEVANCE",
    }
    data = _get(params)
    return data.get("feed", [])


def fetch_news() -> list[dict]:
    """
    Fetch energy/commodity news and sentiment from Alpha Vantage.

    Makes at most 2 NEWS_SENTIMENT API calls (one broad energy/commodities call
    and one financial-markets/macro call) to stay within free-tier quotas.
    Results are cached to data/raw/av_news.json for AV_CACHE_TTL_HOURS.

    Returns a list of normalised article dicts (same schema as Guardian/GDELT
    articles, plus 'sentiment' and 'av_topics' fields).
    """
    if not ALPHAVANTAGE_API_KEY:
        logger.warning("ALPHAVANTAGE_API_KEY not set — skipping AV news fetch")
        return []

    cache_path = DATA_RAW_DIR / "av_news.json"

    if _is_cache_fresh(cache_path):
        logger.info("AV news cache hit: %s", cache_path.name)
        try:
            with open(cache_path, encoding="utf-8") as fh:
                return json.load(fh)
        except Exception as exc:
            logger.warning("AV news cache read error: %s", exc)

    all_raw: list[dict] = []
    seen_urls: set[str] = set()

    # Call 1: energy + commodities topics (the most relevant for this dashboard)
    try:
        call1_topics = "energy_transportation,commodities"
        logger.info("AV news fetch: topics=%s", call1_topics)
        raw1 = _fetch_news_page(call1_topics, limit=50)
        for item in raw1:
            url = item.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_raw.append(item)
        logger.info("AV news call 1: %d articles", len(raw1))
    except Exception as exc:
        logger.warning("AV news call 1 failed: %s", exc)

    # Call 2: financial markets + macro (for volatility, broader Europe context)
    try:
        call2_topics = "financial_markets,economy_macro"
        logger.info("AV news fetch: topics=%s", call2_topics)
        raw2 = _fetch_news_page(call2_topics, limit=50)
        for item in raw2:
            url = item.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_raw.append(item)
        logger.info("AV news call 2: %d new articles", len(raw2))
    except Exception as exc:
        logger.warning("AV news call 2 failed: %s", exc)

    if not all_raw:
        logger.warning("AV news: no articles retrieved")
        return []

    articles = [_normalise_article(item) for item in all_raw]
    articles.sort(key=lambda a: (-a["relevance_score"], a.get("publishedAt", "")))

    with open(cache_path, "w", encoding="utf-8") as fh:
        json.dump(articles, fh, ensure_ascii=False, indent=2)
    logger.info("AV news: %d articles cached", len(articles))
    return articles


# ---------------------------------------------------------------------------
# Adapter entry point
# ---------------------------------------------------------------------------

def fetch_all() -> dict:
    """
    Fetch all Alpha Vantage data (metals + news) and return a summary dict.

    Called by scripts/fetch_all.py as part of the main pipeline.
    """
    if not ALPHAVANTAGE_API_KEY:
        logger.warning("ALPHAVANTAGE_API_KEY not set — Alpha Vantage adapter skipped")
        return {}

    metals = fetch_metals()
    news = fetch_news()

    summary: dict[str, Any] = {
        "metals_fetched": sorted(metals.keys()),
        "metals_rows": {k: len(v) for k, v in metals.items()},
        "news_articles": len(news),
    }
    logger.info("Alpha Vantage fetch complete: %s", summary)
    return summary
