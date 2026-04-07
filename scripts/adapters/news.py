"""
scripts/adapters/news.py
------------------------
Fetches country- and energy-topic-aware news articles.

Primary source:  The Guardian Open Platform API
Fallback source: GDELT Doc API v2 (no API key required)

Each article is returned with:
  id, headline, url, publishedAt, source, country_tags, topic_tags,
  summary, relevance_score

Results are saved to data/raw/news.json.
"""

import hashlib
import json
import logging
import sys
from datetime import datetime, timedelta, timezone
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
from config.series_map import COUNTRIES, NEWS_TOPICS
from config.settings import (
    DATA_RAW_DIR,
    GUARDIAN_API_KEY,
    MAX_RETRIES,
    REQUEST_TIMEOUT,
    RETRY_BACKOFF,
)

logger = logging.getLogger(__name__)

GUARDIAN_API_BASE = "https://content.guardianapis.com/search"
GDELT_API_BASE = "https://api.gdeltproject.org/api/v2/doc/doc"

# Days of news to fetch
NEWS_LOOKBACK_DAYS = 7
# Guardian sections relevant to energy
GUARDIAN_SECTIONS = "environment,business,world"
# Base energy keywords
ENERGY_KEYWORDS = [
    "energy", "electricity", "power", "natural gas", "LNG", "wind", "solar",
    "nuclear", "coal", "oil", "renewables", "emissions", "carbon", "ETS",
    "electricity market", "energy crisis", "grid",
]


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
def _get(url: str, params: dict) -> requests.Response:
    resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp


def _make_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:16]


def _detect_topics(text: str) -> list[str]:
    """Return list of topic keys whose keywords appear in *text*."""
    text_lower = text.lower()
    found = []
    for topic, keywords in NEWS_TOPICS.items():
        if any(kw.lower() in text_lower for kw in keywords):
            found.append(topic)
    return found


def _detect_countries(text: str) -> list[str]:
    """Return list of ISO country codes mentioned in *text*."""
    text_lower = text.lower()
    found = []
    for code, name in COUNTRIES.items():
        if name.lower() in text_lower or code.lower() in text_lower:
            found.append(code)
    return found


def _score_article(headline: str, summary: str, country_tags: list, topic_tags: list) -> float:
    """Simple relevance score 0–10 based on keyword density and tag richness."""
    combined = f"{headline} {summary}".lower()
    kw_hits = sum(1 for kw in ENERGY_KEYWORDS if kw.lower() in combined)
    score = min(kw_hits * 1.5, 6.0) + min(len(topic_tags) * 0.5, 2.0) + min(len(country_tags) * 0.5, 2.0)
    return round(min(score, 10.0), 1)


def _fetch_guardian(country_name: str, lookback_days: int) -> list[dict]:
    """Fetch articles for one country from the Guardian API."""
    if not GUARDIAN_API_KEY:
        return []

    from_date = (datetime.now(timezone.utc) - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
    energy_q = " OR ".join(ENERGY_KEYWORDS[:8])
    query = f"({energy_q}) AND {country_name}"

    params = {
        "api-key": GUARDIAN_API_KEY,
        "q": query,
        "section": GUARDIAN_SECTIONS,
        "from-date": from_date,
        "page-size": 50,
        "show-fields": "trailText,headline,thumbnail",
        "order-by": "relevance",
    }
    try:
        resp = _get(GUARDIAN_API_BASE, params)
        data = resp.json().get("response", {}).get("results", [])
    except Exception as exc:
        logger.warning("Guardian fetch failed for %s: %s", country_name, exc)
        return []

    articles = []
    for item in data:
        headline = item.get("fields", {}).get("headline", item.get("webTitle", ""))
        summary = item.get("fields", {}).get("trailText", "")
        url = item.get("webUrl", "")
        published_at = item.get("webPublicationDate", "")
        country_tags = _detect_countries(f"{headline} {summary}")
        topic_tags = _detect_topics(f"{headline} {summary}")
        articles.append({
            "id": _make_id(url),
            "headline": headline,
            "url": url,
            "publishedAt": published_at,
            "source": "guardian",
            "country_tags": country_tags,
            "topic_tags": topic_tags,
            "summary": summary,
            "relevance_score": _score_article(headline, summary, country_tags, topic_tags),
        })
    return articles


def _fetch_gdelt(country_name: str, lookback_days: int) -> list[dict]:
    """Fetch articles from GDELT as fallback (no key required)."""
    energy_q = " OR ".join(ENERGY_KEYWORDS[:5])
    query = f'({energy_q}) "{country_name}" sourcelang:English'
    params = {
        "query": query,
        "mode": "artlist",
        "maxrecords": 50,
        "format": "json",
        "timespan": f"{lookback_days}d",
    }
    try:
        resp = _get(GDELT_API_BASE, params)
        data = resp.json()
        articles_raw = data.get("articles", [])
    except Exception as exc:
        logger.warning("GDELT fetch failed for %s: %s", country_name, exc)
        return []

    articles = []
    for item in articles_raw:
        headline = item.get("title", "")
        url = item.get("url", "")
        summary = item.get("seendate", "")  # GDELT doesn't give summaries
        published_at = item.get("seendate", "")
        country_tags = _detect_countries(headline)
        topic_tags = _detect_topics(headline)
        articles.append({
            "id": _make_id(url),
            "headline": headline,
            "url": url,
            "publishedAt": published_at,
            "source": "gdelt",
            "country_tags": country_tags,
            "topic_tags": topic_tags,
            "summary": "",
            "relevance_score": _score_article(headline, summary, country_tags, topic_tags),
        })
    return articles


def fetch_all(lookback_days: int = NEWS_LOOKBACK_DAYS) -> list[dict]:
    """
    Fetch energy news for all configured countries.

    Uses Guardian when the API key is available, falls back to GDELT.
    Deduplicates by URL and saves to data/raw/news.json.
    """
    all_articles: list[dict] = []
    seen_ids: set[str] = set()

    for code, name in COUNTRIES.items():
        logger.info("Fetching news for %s (%s)", name, code)
        if GUARDIAN_API_KEY:
            articles = _fetch_guardian(name, lookback_days)
        else:
            logger.info("No GUARDIAN_API_KEY — using GDELT for %s", name)
            articles = _fetch_gdelt(name, lookback_days)

        # If Guardian gave nothing, try GDELT as fallback
        if not articles:
            articles = _fetch_gdelt(name, lookback_days)

        for art in articles:
            if art["id"] not in seen_ids:
                seen_ids.add(art["id"])
                all_articles.append(art)

    # Sort by relevance score descending, then by date ascending
    all_articles.sort(key=lambda a: (-a["relevance_score"], a["publishedAt"]))

    cache_path = DATA_RAW_DIR / "news.json"
    with open(cache_path, "w", encoding="utf-8") as fh:
        json.dump(all_articles, fh, ensure_ascii=False, indent=2)
    logger.info("News: %d articles saved", len(all_articles))
    return all_articles
