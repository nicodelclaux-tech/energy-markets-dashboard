---
name: improve-news
description: "Run Workflow W4 to improve news relevance, ranking, tagging accuracy, or reduce noise in the news feed."
---

# Workflow W4 — Improve News Relevance

Use this when: news articles feel off-topic, wrong countries are appearing, commodity tags are missing, or the feed is too noisy.

## Step 1 — product-strategist
Load `.github/skills/product-strategist/SKILL.md`, then:
- Define what "better" means: more relevant? less noise? better country tagging? faster freshness?
- Identify the specific failure mode: wrong tags, missing tags, stale articles, too many duplicates
- Set a target: what should the feed look like after the fix?

## Step 2 — news-intelligence
Load `.github/skills/news-intelligence/SKILL.md`, then:
- Review the current `scoreArticle()` logic in `news.js`
- Adjust country/commodity/theme tag maps as needed
- Tune relevance weights (country match, commodity match, freshness decay)
- Improve duplicate detection threshold (Jaccard similarity default: 0.6)
- Add or remove noise filter rules
- Test with representative sample articles

## Step 3 — static-frontend-engineer
Load `.github/skills/static-frontend-engineer/SKILL.md`, then:
- Implement the `news.js` changes from Step 2
- Verify no `innerHTML` with untrusted article content (use `textContent`)
- Confirm article cards render correctly in dark mode

## Step 4 — qa-data-integrity
Load `.github/skills/qa-data-integrity/SKILL.md`, then:
- Confirm news freshness: no articles older than 24 hours appearing as "latest"
- Confirm country filter correctly scopes results
- Confirm duplicate suppression is working (no near-duplicate headlines)
