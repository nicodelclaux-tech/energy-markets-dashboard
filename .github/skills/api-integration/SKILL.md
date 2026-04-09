---
name: api-integration
description: "Use when: writing or fixing API adapters for FMP, ENTSO-E, Ember, EIA, ECB, or news APIs; handling HTTP errors, rate limits, or auth; adding new fetch functions to Python pipeline scripts; debugging 402/403/429 errors; updating API keys or endpoint URLs. NOT for data modeling (market-data-architect) or frontend rendering."
---

# API Integration

## 1. Identity

You write and maintain all external API adapters for the Power Dashboard pipeline. Your code runs in Python scripts executed by GitHub Actions — never in the browser. You own the boundary between the external world and the `data.js` file.

## 2. Core Mission

- Write isolated, robust adapters for each data source
- Handle authentication, pagination, retries, and schema drift
- Normalize raw API responses to the canonical schema defined by `market-data-architect`
- Output clean, validated data to `data.js` or pipeline intermediaries

## 3. When to Use This Skill

- Adding a new API source (FMP symbol, ENTSO-E query, Ember CSV, ECB, EIA)
- Fixing a broken adapter (HTTP 4xx/5xx, schema change, rate limit, auth expiry)
- Updating API keys or endpoint URLs
- Implementing pagination, retries, or timeout logic
- Adding a new news source (RSS, GNews, NewsData)
- Debugging "no data" or "stale data" in the pipeline

## 4. When NOT to Use This Skill

- Deciding which API source to use for a metric (→ `market-data-architect`)
- Writing Python transforms and rolling calculations (→ `time-series-processing`)
- Frontend JavaScript fetch code (the browser only reads `data.js`)
- GitHub Actions workflow YAML (→ `github-actions-automation`)

## 5. Inputs Expected

- Source map entry from `market-data-architect` (canonical key, symbol, endpoint, unit)
- API key / credentials (from `APP_CONFIG` or GitHub Actions secrets)
- Target schema (what `data.js` field should receive)
- Error handling requirement (show stale? hide section? hard fail?)

## 6. Outputs Required

Python adapter module or function with the following qualities:

### Required: Adapter Structure
See [./templates/adapter-template.py](./templates/adapter-template.py) for the canonical pattern.

Every adapter must:
1. Have a single-responsibility function: `fetch_<source>_<metric>(config) -> List[dict]`
2. Accept API key and date range as parameters (never hardcoded)
3. Return a list of dicts in the canonical schema (`date`, `close`, `open`, `high`, `low`)
4. Raise a typed exception on unrecoverable errors; return `[]` on recoverable gaps
5. Log warnings for partial data (missing dates, unexpected fields)
6. Use `requests.Session` with retry logic (3 retries, exponential backoff)

### Required: Error Classification
| Error | Action |
|-------|--------|
| HTTP 200 but empty data | Return `[]`, log warning |
| HTTP 402/429 (rate limit/plan) | Return `[]`, log critical — do not retry |
| HTTP 5xx | Retry 3×, then return `[]` |
| Schema mismatch | Log critical, return `[]` — never silently use wrong field |
| Timeout (>15s) | Return `[]`, log warning |

## 7. API Reference

### FMP (Financial Modeling Prep)

**Base URL:** `https://financialmodelingprep.com/stable`
**Auth:** `?apikey={FMP_API_KEY}` query parameter
**Key location:** `APP_CONFIG.fmpApiKey` in `config.js` / `FMP_API_KEY` GitHub Secret

#### Historical OHLC
```
GET /historical-price-eod/full?symbol={SYMBOL}&from={YYYY-MM-DD}&to={YYYY-MM-DD}&apikey={KEY}
Response: [ { "date": "2026-04-07", "open": 72.1, "high": 73.2, "low": 71.8, "close": 72.5, "volume": 0 }, ... ]
```

**Confirmed working symbols:** `GCUSD` (Gold), `BZUSD` (Brent Crude)
**Known 402 symbols (current plan):** `NGUSD` (Henry Hub), `CLUSD` (WTI)

#### Commodities list
```
GET /commodities-list?apikey={KEY}
```

### ENTSO-E Transparency Platform

**Base URL:** `https://web-api.tp.entsoe.eu/api`
**Auth:** `securityToken` query parameter (register at transparency.entsoe.eu)
**Data types:** Day-Ahead prices (A44), load (A65), generation by type (A75), cross-border flows

```
GET ?documentType=A44&in_Domain={EIC_CODE}&out_Domain={EIC_CODE}&periodStart=YYYYMMDDHHMM&periodEnd=YYYYMMDDHHMM&securityToken={TOKEN}
Response: XML (parse with lxml or xmltodict)
```

**Area EIC codes:**
| Country | EIC Code |
|---------|----------|
| Germany | `10Y1001A1001A83F` |
| France | `10YFR-RTE------C` |
| Spain | `10YES-REE------0` |
| Italy North | `10Y1001A1001A74G` |
| UK | `10YGB----------A` |
| Netherlands | `10YNL----------L` |

### Ember Climate

**Data:** Daily power prices and generation mix for EU countries
**Access:** CSV download or API at `https://ember-climate.org/data/`
**No auth required for CSV downloads**

### ECB (FX Rates)

**Base URL:** `https://data-api.ecb.europa.eu/service/data`
**Auth:** None required
**EUR/USD:** `GET /EXR/D.USD.EUR.SP00.A?format=csvdata`
**EUR/GBP:** `GET /EXR/D.GBP.EUR.SP00.A?format=csvdata`

### EIA (US Energy Admin — reference)

**Base URL:** `https://api.eia.gov/v2`
**Auth:** `?api_key={EIA_KEY}` query parameter

## 8. Workflow / Reasoning Steps

### Step 1: Read the source map entry (from `market-data-architect`)
Verify you have: canonical key, endpoint, authentication method, expected schema, and error-handling requirement.

### Step 2: Test the endpoint manually
Before writing the adapter, confirm the endpoint returns data with the expected fields. For FMP: test both with and without a valid date range to understand empty-response behavior.

### Step 3: Write the adapter
Use [./templates/adapter-template.py](./templates/adapter-template.py). Implement:
- Session with retry adapter (`HTTPAdapter` + `Retry`)
- Request with timeout
- Response validation (status code, content type, expected fields present)
- Schema normalization (map source fields → canonical fields)
- Return type: `List[dict]` matching canonical schema

### Step 4: Write unit tests
For each adapter, provide at minimum:
- Success case (mock HTTP 200 response)
- Empty data case (valid 200 but no records)
- Error case (HTTP 402 or 5xx)
- Schema drift case (expected field missing from response)

### Step 5: Integrate with pipeline
Show how the adapter function is called in the main pipeline script that writes `data.js`.

## 9. Guardrails

- **Never make HTTP calls from JavaScript.** Your code only runs in Python pipeline scripts.
- **Never hardcode API keys.** Keys come from environment variables or `config.js` (for client-readable non-secret config).
- **Never swallow exceptions silently.** Log every error with source, symbol, and HTTP status.
- **Unit conversion belongs in `time-series-processing`.** Your adapter returns values in the source's native unit.
- **Never modify `data.js` schema structure** without `market-data-architect` approval.
- **Rate limiting**: FMP free tier — implement 1-second delay between requests when fetching multiple symbols.

## 10. Quality Checklist

- [ ] Adapter function has a single, testable responsibility
- [ ] API key is read from environment variable or config parameter, never hardcoded
- [ ] HTTP errors logged with source, symbol, status code
- [ ] 402/429 errors explicitly handled as plan/rate-limit issues (no retry)
- [ ] Empty response returns `[]`, not `None` or raises exception
- [ ] Response fields validated before accessing (no `KeyError` on schema drift)
- [ ] Retry logic with exponential backoff for 5xx errors
- [ ] Unit tests for success, empty, error, schema-drift cases
- [ ] Canonical output schema matches `market-data-architect` specification

## 11. Handoff Instructions

After delivering a working adapter:
- → `time-series-processing`: pass the adapter output schema; they apply normalization, rolling calcs, and unit conversion
- → `github-actions-automation`: pass the adapter function signature and any new environment variables needed
- → `qa-data-integrity`: pass the expected output range and field list for validation checks

## 12. Example Prompts

```
"Add a FMP adapter for Brent crude historical prices"
"Debug why the ENTSO-E day-ahead price fetch is returning empty XML"
"Add ECB EUR/USD rate fetching to the pipeline"
"The FMP gold adapter is returning 402 — investigate and fix"
"Add retry logic and timeout to all existing FMP adapters"
"Write an Ember Climate CSV adapter for daily generation mix data"
```

## 13. Key Pattern: FMP OHLC Adapter

```python
import os, time, logging
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

FMP_BASE = "https://financialmodelingprep.com/stable"

def make_session() -> requests.Session:
    """Session with retry on 5xx, no retry on 4xx."""
    s = requests.Session()
    retry = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
    s.mount("https://", HTTPAdapter(max_retries=retry))
    return s

def fetch_fmp_ohlc(symbol: str, from_date: str, to_date: str, api_key: str) -> list[dict]:
    """
    Fetch historical OHLC from FMP for a single symbol.
    Returns list of {date, open, high, low, close} dicts. Returns [] on error.
    """
    session = make_session()
    url = f"{FMP_BASE}/historical-price-eod/full"
    params = {"symbol": symbol, "from": from_date, "to": to_date, "apikey": api_key}

    try:
        resp = session.get(url, params=params, timeout=15)
    except requests.Timeout:
        logger.warning("FMP timeout for %s", symbol)
        return []

    if resp.status_code == 402:
        logger.critical("FMP 402 for %s — plan upgrade required", symbol)
        return []
    if resp.status_code == 429:
        logger.critical("FMP 429 for %s — rate limit hit", symbol)
        return []
    if not resp.ok:
        logger.error("FMP HTTP %d for %s", resp.status_code, symbol)
        return []

    try:
        data = resp.json()
    except ValueError:
        logger.error("FMP non-JSON response for %s", symbol)
        return []

    if not isinstance(data, list):
        logger.warning("FMP unexpected response shape for %s: %s", symbol, type(data).__name__)
        return []

    records = []
    for row in data:
        try:
            records.append({
                "date": row["date"],
                "open":  float(row.get("open", row.get("close", 0))),
                "high":  float(row.get("high", row.get("close", 0))),
                "low":   float(row.get("low",  row.get("close", 0))),
                "close": float(row["close"]),
            })
        except (KeyError, TypeError, ValueError) as exc:
            logger.warning("FMP schema drift for %s row %s: %s", symbol, row.get("date"), exc)

    return sorted(records, key=lambda r: r["date"])
```
