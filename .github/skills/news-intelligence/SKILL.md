---
name: news-intelligence
description: "Use when: structuring or improving the news feed, tagging articles by country or commodity, defining or tuning relevance ranking, removing duplicates or low-value noise, changing news sources, or implementing country-aware filtering of news articles. NOT for API fetch code (api-integration) or frontend card rendering (static-frontend-engineer)."
---

# News Intelligence

## 1. Identity

You structure the country-aware news feed for a professional energy markets dashboard. News is a secondary intelligence layer — it should surface genuinely relevant market context, not generic energy headlines. Your job is tagging accuracy, ranking precision, and noise reduction.

## 2. Core Mission

- Define article tagging schema (country, commodity, theme)
- Design relevance ranking logic for the active market selection
- Remove duplicates, promotional content, and low-signal articles
- Produce frontend-ready article objects with all required metadata

## 3. When to Use This Skill

- News feed feels noisy or irrelevant to the selected country/commodity
- Adding a new commodity to the news tag taxonomy (e.g., carbon EUA)
- Changing news sources (adding GNews, NewsData, or new RSS feeds)
- Tuning ranking weights for market context relevance
- Implementing country-level filtering when user selects a specific country

## 4. When NOT to Use This Skill

- Fetching news from APIs (→ `api-integration`)
- Rendering article cards in HTML/CSS (→ `static-frontend-engineer`)
- Deciding where the news panel appears on the page (→ `dashboard-ui-architect`)

## 5. Inputs Expected

- Current `news.js` implementation and `COMMODITY_META` mapping
- Active country selection (`S.country`) and commodity selection
- User feedback on noise level or irrelevant articles
- List of available news sources and queries

## 6. Article Object Schema

Every article processed must conform to:
```js
{
  title:       string,    // original headline, no truncation
  source:      string,    // e.g. "Reuters Energy", "Bloomberg", "ICIS"
  publishedAt: string,    // ISO 8601 datetime: "2026-04-07T09:30:00Z"
  url:         string,    // HTTPS link
  tags: {
    countries:   string[],  // e.g. ["de", "fr"] — ISO 2-letter codes
    commodities: string[],  // e.g. ["power", "ttf-gas", "brent"]
    themes:      string[],  // e.g. ["price-spike", "outage", "renewables", "policy"]
  },
  relevanceScore: number,  // 0–100, computed by ranking function
  duplicate:   boolean,    // true = suppress from display
}
```

## 7. Country Tag Mapping

| Tag | Countries to match (keywords) |
|-----|-------------------------------|
| `de` | Germany, German, Bundesnetz, EPEX DE, DE bidding zone |
| `fr` | France, French, RTE France, EPEX FR, FR bidding zone |
| `es` | Spain, Spanish, REE, OMIE, Iberian, Iberia |
| `it` | Italy, Italian, GME, Terna, IT bidding zone |
| `uk` | UK, Britain, British, Elexon, N2EX, National Grid |
| `nl` | Netherlands, Dutch, TenneT NL, APX |
| `eu` | EU, European, ENTSO-E, market-wide (applies to all countries) |

## 8. Commodity Tag Mapping

| Tag | Match keywords |
|-----|---------------|
| `power` | electricity, power, megawatt, MWh, Day-Ahead, baseload, peak load |
| `ttf-gas` | TTF, TTF gas, natural gas, LNG, gas price, gas market |
| `brent` | Brent, crude oil, oil price |
| `wti` | WTI, West Texas, NYMEX crude |
| `coal` | coal, hard coal, API2, thermal coal |
| `eua-carbon` | EUA, EU ETS, CO2, carbon price, EU carbon |
| `gold` | gold, precious metals |
| `hydrogen` | hydrogen, H2, green hydrogen, electrolyzer |

## 9. Theme Tag Taxonomy

Apply these standard theme tags to articles:

| Theme | Trigger keywords |
|-------|-----------------|
| `price-spike` | spike, surge, soar, record high, all-time high, jump |
| `price-drop` | plunge, drop, fall, collapse, record low, crash |
| `outage` | outage, unplanned, trip, offline, derate, fault |
| `maintenance` | maintenance, planned outage, shutdown |
| `renewables` | wind, solar, offshore, renewable, clean energy |
| `demand` | demand, consumption, load, heatwave, cold snap |
| `supply` | supply, import, export, interconnector, flow |
| `policy` | regulation, policy, REMIT, EU directive, government |
| `storage` | storage, gas storage, battery storage, reservoir |
| `forecast` | forecast, outlook, prediction, expected, projected |

## 10. Relevance Ranking Algorithm

Score each article 0–100 based on match to active selection:

```js
function scoreArticle(article, activeCountry, activeKeys) {
  let score = 0;

  // Country match (max 50 points)
  if (article.tags.countries.includes(activeCountry)) {
    score += 50;
  } else if (article.tags.countries.includes('eu')) {
    score += 20;
  } else if (article.tags.countries.length === 0) {
    score += 10;  // generic/global article
  }

  // Commodity match (max 30 points)
  const commodityOverlap = article.tags.commodities.filter(c => activeKeys.includes(c));
  score += Math.min(30, commodityOverlap.length * 15);

  // Power always relevant on power page
  if (article.tags.commodities.includes('power')) {
    score += 10;
  }

  // Freshness penalty (articles >48h old lose 20 points)
  const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3_600_000;
  if (ageHours > 48) score -= 20;
  if (ageHours > 96) score -= 20;

  // Low-signal penalty
  if (isLowSignal(article)) score -= 30;

  return Math.max(0, Math.min(100, score));
}
```

## 11. Duplicate & Noise Filter

### Duplicate Detection
```js
function isDuplicate(article, seen) {
  // Normalize: lowercase, remove punctuation, strip "Energy" / "Market" etc.
  const normalized = article.title.toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\b(energy|market|report|update|news|data)\b/g, '')
    .trim();

  const sim = seen.find(s => jaccardSimilarity(normalized, s) > 0.6);
  if (sim) return true;
  seen.push(normalized);
  return false;
}
```

### Low-Signal Detection
Articles are flagged as low-signal if they match any of these:
- Source is a press release aggregator (PR Newswire, Business Wire, Globe Newswire)
- Title contains: "webinar", "conference", "award", "partnership announcement", "career", "hiring"
- Title contains: "analyst upgrade", "buy rating", "stock" (for non-equity dashboard)
- Word count < 50 (too short to be informative)
- Article > 7 days old

## 12. The `COMMODITY_META` Map

Used in `news.js` to link commodity keys to news query terms:

```js
const COMMODITY_META = {
  brent:     { label: 'Brent Crude',      color: '#c0392b', icon: '🛢', query: 'Brent crude oil price market Europe' },
  gold:      { label: 'Gold',             color: '#d97706', icon: '🥇', query: 'gold price XAU precious metals' },
  henryhub:  { label: 'Henry Hub Gas',    color: '#2563eb', icon: '🔥', query: '"Henry Hub" natural gas LNG price market' },
  wti:       { label: 'WTI Crude',        color: '#7c3aed', icon: '🛢', query: 'WTI crude oil NYMEX price market' },
  'ttf-gas': { label: 'TTF Natural Gas',  color: '#d97706', icon: '🔥', query: 'TTF natural gas price Netherlands Europe' },
  'eua-carbon':{ label:'EU Carbon (EUA)', color: '#059669', icon: '🌿', query: 'EU ETS carbon price EUA CO2 emissions' },
};
```

## 13. Guardrails

- **Never show articles older than 7 days** unless there is no newer content.
- **Never show promotional content.** When in doubt, filter it out.
- **Ranking must be deterministic.** Same article state + same S state = same score.
- **Empty state instead of zero articles.** If no articles pass filters, show "No recent news for this selection" card rather than hiding the section.
- **No `innerHTML` for article titles.** Render via `textContent` to prevent XSS from untrusted headlines.

## 14. Quality Checklist

- [ ] Every article has `tags.countries`, `tags.commodities`, `tags.themes`
- [ ] Duplicate detection runs before ranking
- [ ] Low-signal filter applied before display
- [ ] Relevance score recalculated when `S.country` changes
- [ ] Empty state displayed when < 1 article passes filter
- [ ] No article text rendered via `innerHTML` — use `textContent`
- [ ] `publishedAt` displayed as relative time ("3h ago") not raw ISO string

## 15. Handoff Instructions

After delivering ranking/tagging logic:
- → `static-frontend-engineer`: pass the final article schema and the ranking function signature so they can render the card list
- → `api-integration`: pass updated `query` strings if new news sources are being added

## 16. Example Prompts

```
"Improve news relevance — too many generic 'energy market' articles showing for Spain"
"Add EU carbon (EUA) and hydrogen to the news tag taxonomy"
"The news panel shows articles from 3 days ago when better ones exist — fix the freshness logic"
"Add a news source for ICIS Energy RSS feed"
"Deduplicate articles that are clearly reposted from the same underlying Reuters wire"
```
