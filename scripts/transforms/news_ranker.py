"""
scripts/transforms/news_ranker.py
----------------------------------
Relevance scoring, topic classification, country detection, and deduplication
for news articles.

This module is intentionally independent of any specific news source so it
can be applied to both Guardian and GDELT output uniformly.
"""

import logging
from typing import Optional

from config.series_map import COUNTRIES, NEWS_TOPICS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Energy keyword list for relevance scoring
# ---------------------------------------------------------------------------
ENERGY_KEYWORDS = [
    "energy", "electricity", "power", "natural gas", "LNG", "wind", "solar",
    "nuclear", "coal", "oil", "renewables", "emissions", "carbon", "ETS",
    "electricity market", "energy crisis", "grid", "storage", "battery",
    "offshore", "onshore", "capacity", "generation", "demand", "supply",
    "price", "MWh", "GWh", "TWh", "pipeline", "regasification",
]


def detect_topics(text: str) -> list[str]:
    """Return list of topic keys whose keywords appear in *text*."""
    text_lower = text.lower()
    found = []
    for topic, keywords in NEWS_TOPICS.items():
        if any(kw.lower() in text_lower for kw in keywords):
            found.append(topic)
    return found


def detect_countries(text: str) -> list[str]:
    """Return list of ISO codes for countries mentioned in *text*."""
    text_lower = text.lower()
    found = []
    for code, name in COUNTRIES.items():
        if name.lower() in text_lower:
            found.append(code)
    return found


def score_article(
    headline: str,
    summary: str,
    country_tags: list[str],
    topic_tags: list[str],
) -> float:
    """
    Compute a relevance score in the range 0–10.

    Score components:
    - Energy keyword density in headline + summary (up to 6 pts)
    - Number of distinct topic tags (up to 2 pts)
    - Number of country tags (up to 2 pts)
    """
    combined = f"{headline} {summary}".lower()
    kw_hits = sum(1 for kw in ENERGY_KEYWORDS if kw.lower() in combined)
    score = (
        min(kw_hits * 1.2, 6.0)
        + min(len(topic_tags) * 0.5, 2.0)
        + min(len(country_tags) * 0.5, 2.0)
    )
    return round(min(score, 10.0), 1)


def rank_news(
    articles: list[dict],
    max_per_country: int = 5,
    min_score: float = 2.0,
) -> list[dict]:
    """
    Deduplicate, score, and select the top *max_per_country* articles for each
    country.

    Articles without any country tag are distributed to all countries.

    Parameters
    ----------
    articles       : raw list of article dicts (with at least headline, url,
                     publishedAt, summary fields)
    max_per_country: maximum articles returned per country
    min_score      : minimum relevance score to retain an article

    Returns
    -------
    Deduped, scored, ranked list of article dicts suitable for the news feed.
    """
    # Enrich each article with detected tags and score
    enriched = []
    seen_urls: set[str] = set()
    for art in articles:
        url = art.get("url", "")
        if url in seen_urls:
            continue
        seen_urls.add(url)

        headline = art.get("headline", "")
        summary = art.get("summary", "")
        country_tags = art.get("country_tags") or detect_countries(f"{headline} {summary}")
        topic_tags = art.get("topic_tags") or detect_topics(f"{headline} {summary}")
        rel_score = art.get("relevance_score") or score_article(headline, summary, country_tags, topic_tags)

        if rel_score < min_score:
            continue

        enriched.append({
            **art,
            "country_tags": country_tags,
            "topic_tags": topic_tags,
            "relevance_score": rel_score,
        })

    # Sort descending by score, then by date
    enriched.sort(key=lambda a: (-a["relevance_score"], a.get("publishedAt", "")))

    # Select top-N per country
    per_country_count: dict[str, int] = {cc: 0 for cc in COUNTRIES}
    selected_ids: set[str] = set()
    final: list[dict] = []

    for art in enriched:
        art_id = art.get("id", art.get("url", ""))
        if art_id in selected_ids:
            continue
        tags = art.get("country_tags", [])
        targets = tags if tags else list(COUNTRIES.keys())
        for cc in targets:
            if per_country_count.get(cc, 0) < max_per_country:
                per_country_count[cc] = per_country_count.get(cc, 0) + 1
                if art_id not in selected_ids:
                    selected_ids.add(art_id)
                    final.append(art)
                break

    logger.info("news_ranker: %d → %d articles after ranking", len(articles), len(final))
    return final


def filter_news(articles: list[dict], min_score: float = 3.0) -> list[dict]:
    """Return only articles with relevance_score >= *min_score*."""
    return [a for a in articles if a.get("relevance_score", 0) >= min_score]
